const { TrainStation, Airport, Port, Destination, City, Nation, TransportMean, Sequelize, sequelize } = require('../models');
const logger = require('../utils/logger');
const Op = Sequelize.Op;

const getPlaceModel = (type) => {
    switch (type) {
        case 'TrainStation': return TrainStation;
        case 'Airport': return Airport;
        case 'Port': return Port;
        case 'Destination': return Destination;
        default: return null;
    }
};

const encodeId = (id, type) => {
    return Buffer.from(`${type}:${id}`).toString('base64');
};

const decodeId = (hash) => {
    try {
        const decoded = Buffer.from(hash, 'base64').toString('utf-8');
        const [type, id] = decoded.split(':');
        return { id, type };
    } catch (e) {
        return null;
    }
};

const formatPlace = async (id, type, transaction = null) => {
    const model = getPlaceModel(type);
    if (!model) return null;

    const isMany = (type === 'Airport' || type === 'Port');
    const cityAlias = isMany ? 'cities' : 'city';

    const place = await model.findByPk(id, {
        include: [{
            model: City,
            as: cityAlias,
            include: [{ model: Nation, as: 'nation' }]
        }],
        transaction
    });

    if (!place) return null;

    let cityName = 'Unknown';
    let nationName = 'Unknown';

    if (isMany) {
        if (place.cities && place.cities.length > 0) {
            cityName = place.cities.map(c => c.name).join(', ');
            nationName = place.cities[0].nation ? place.cities[0].nation.name : 'Unknown';
        }
    } else {
        if (place.city) {
            cityName = place.city.name;
            nationName = place.city.nation ? place.city.nation.name : 'Unknown';
        }
    }

    return {
        id: encodeId(place.id, type),
        street: place.street,
        city: cityName,
        nation: nationName
    };
};

// Map OpenAPI schema types to our internal model names
const typeMap = {
    'TrainStation': 'TrainStation',
    'Airport': 'Airport',
    'Port': 'Port',
    'Destination': 'Destination'
};

const getPossibleVehicleTypes = (fromType, toType, loadType) => {
    const types = [];
    
    // Compatibility mapping
    const compatibility = {
        'LocalServing': ['PACKAGE'],
        'Lorry': ['PACKAGE', 'STANDARD', 'WIDE_LOAD'],
        'Train': ['STANDARD', 'WIDE_LOAD'],
        'Plane': ['PACKAGE', 'STANDARD'],
        'Ship': ['PACKAGE', 'STANDARD', 'WIDE_LOAD']
    };

    // Specialized types
    if (fromType === 'TrainStation' && toType === 'TrainStation') {
        if (compatibility['Train'].includes(loadType)) types.push('Train');
    }
    if (fromType === 'Airport' && toType === 'Airport') {
        if (compatibility['Plane'].includes(loadType)) types.push('Plane');
    }
    if (fromType === 'Port' && toType === 'Port') {
        if (compatibility['Ship'].includes(loadType)) types.push('Ship');
    }
        
    // Versatile types (can go everywhere)
    if (compatibility['Lorry'].includes(loadType.toUpperCase())) types.push('Lorry');
    if (compatibility['LocalServing'].includes(loadType.toUpperCase())) types.push('LocalServing');
    
    return types;
};

exports.createTransportRequest = async (req, res) => {
    const startTime = Date.now();
        let transaction = await sequelize.transaction();
    try {
        const { from, to, loadType, quantity, requestedAt } = req.body;
        
        const fromInfo = decodeId(from.id);
        const toInfo = decodeId(to.id);

        if (!fromInfo || !toInfo) {
            await transaction.rollback();
            transaction = null;
            return res.status(400).json({ error: 'Invalid from or to place ID format' });
        }

        const findPlaceTransaction = async (info) => {
            const model = getPlaceModel(info.type);
            if (!model) return null;
            const include = [];
            const models = sequelize.models;
            if (info.type === 'TrainStation' || info.type === 'Destination') {
                include.push({ model: models.City, as: 'city' });
            } else if (info.type === 'Airport' || info.type === 'Port') {
                include.push({ model: models.City, as: 'cities' });
            }
            const p = await model.findByPk(info.id, { include, transaction });
            if (p) return { id: p.id, type: info.type, instance: p };
            return null;
        };

        const fromPlaceInfo = await findPlaceTransaction(fromInfo);
        const toPlaceInfo = await findPlaceTransaction(toInfo);

        if (!fromPlaceInfo || !toPlaceInfo) {
            await transaction.rollback();
            transaction = null;
            return res.status(400).json({ error: 'Invalid from or to place ID' });
        }

        const getCityName = (placeInfo) => {
            const instance = placeInfo.instance;
            if (placeInfo.type === 'TrainStation' || placeInfo.type === 'Destination') {
                return instance.city ? instance.city.name : 'Inconnue';
            } else if (placeInfo.type === 'Airport' || placeInfo.type === 'Port') {
                return (instance.cities && instance.cities.length > 0) ? instance.cities[0].name : 'Inconnue';
            }
            return 'Inconnue';
        };

        logger.info(`Nouvelle demande de transport reçue à ${requestedAt || new Date().toISOString()}`, { 
            req,
            details: {
                fromCity: getCityName(fromPlaceInfo),
                toCity: getCityName(toPlaceInfo),
                loadType,
                quantity
            }
        });

        const possibleVehicleTypes = getPossibleVehicleTypes(fromPlaceInfo.type, toPlaceInfo.type, loadType);

        if (possibleVehicleTypes.length === 0) {
            await transaction.rollback();
            transaction = null;
            return res.status(400).json({ error: `No vehicle type compatible with load type ${loadType} for this route.` });
        }

        let remainingQuantity = quantity;
        const selectedVehicles = [];

        // Function to find and assign vehicles
        const findAndAssignVehicles = async (locationId, locationType, isSource) => {
            while (remainingQuantity > 0) {
                const whereClause = {
                    type: { [Op.in]: possibleVehicleTypes },
                    load: 0,
                    id: { [Op.notIn]: selectedVehicles.map(v => v.id) }
                };

                if (isSource) {
                    whereClause.locationId = locationId;
                    whereClause.locationType = locationType;
                }

                const v = await TransportMean.findOne({
                    where: whereClause,
                    order: [
                        // Priorité 1: Les types compatibles spécialisés (si possible)
                        [sequelize.literal(`FIELD(type, ${possibleVehicleTypes.map(t => `'${t}'`).join(', ')})`), 'ASC'],
                        // Priorité 2: La capacité la plus proche de la quantité restante (mais supérieure ou égale si possible)
                        [sequelize.literal(`ABS(capacity - ${remainingQuantity})`), 'ASC']
                    ],
                    transaction
                });

                if (!v) break;

                if (!isSource) {
                    const oldLocationId = v.locationId;
                    const oldLocationType = v.locationType;
                    v.locationId = fromPlaceInfo.id;
                    v.locationType = fromPlaceInfo.type;
                    await v.save({ transaction });
                    logger.info(`Déplacement à vide du véhicule [${v.type} ID:${v.id}] de [${oldLocationType} ID:${oldLocationId}] vers [${fromPlaceInfo.type} ID:${fromPlaceInfo.id}]`);
                }

                const loadForThisVehicle = Math.min(remainingQuantity, v.capacity);
                v.assignedLoad = loadForThisVehicle;
                selectedVehicles.push(v);
                remainingQuantity -= loadForThisVehicle;
            }
        };

        // 1. Chercher d'abord sur place
        await findAndAssignVehicles(fromPlaceInfo.id, fromPlaceInfo.type, true);

        // 2. Si pas assez, chercher ailleurs
        if (remainingQuantity > 0) {
            await findAndAssignVehicles(null, null, false);
        }

        if (remainingQuantity > 0) {
            await transaction.rollback();
            transaction = null;
            return res.status(400).json({ 
                error: `Insufficient fleet capacity. Remaining quantity: ${remainingQuantity} after assigning ${selectedVehicles.length} vehicles.` 
            });
        }

        // 1. Pick up from source (if it's a transitory place)
        if (fromPlaceInfo.instance.pickUp) {
            try {
                await fromPlaceInfo.instance.pickUp(loadType, quantity, { transaction });
            } catch (e) {
                // handle error if necessary
            }
        }

        // Execute transport for each vehicle
        for (const vehicle of selectedVehicles) {
            // 2. Load the vehicle
            vehicle.loadType = loadType;
            vehicle.load = vehicle.assignedLoad;
            await vehicle.save({ transaction });

            // 3. Move to destination
            vehicle.locationId = toPlaceInfo.id;
            vehicle.locationType = toPlaceInfo.type;
            await vehicle.save({ transaction });
            logger.info(`Transport de marchandise [${loadType} x${vehicle.load}] par [${vehicle.type} ID:${vehicle.id}] de [${fromPlaceInfo.type} ID:${fromPlaceInfo.id}] vers [${toPlaceInfo.type} ID:${toPlaceInfo.id}]`);

            // 4. Deliver/Unload at destination
            if (toPlaceInfo.instance.deliver) {
                await toPlaceInfo.instance.deliver(loadType, vehicle.load, { transaction });
            }
            vehicle.load = 0;
            vehicle.loadType = 'EMPTY';
            await vehicle.save({ transaction });
        }

        const response = {
            id: require('crypto').randomUUID(),
            from: await formatPlace(fromPlaceInfo.id, fromPlaceInfo.type, transaction),
            to: await formatPlace(toPlaceInfo.id, toPlaceInfo.type, transaction),
            loadType: loadType,
            quantity: quantity,
            status: 'COMPLETED',
            requestedAt: requestedAt,
            updatedAt: new Date().toISOString(),
            transportMeanId: selectedVehicles.length === 1 ? selectedVehicles[0].id.toString() : selectedVehicles.map(v => v.id).join(', ')
        };

        await transaction.commit();
        transaction = null; // Mark as committed/finished

        const responseTime = Date.now() - startTime;
        logger.info(`Réponse envoyée en ${responseTime}ms`);

        res.status(201).json(response);
    } catch (error) {
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Failed to rollback transaction:', rollbackError);
            }
        }
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
};

exports.getPlaces = async (req, res) => {
    try {
        const { cityName, limit } = req.query;
        let parsedLimit = null;
        if (limit && limit.trim() !== "") {
            parsedLimit = parseInt(limit, 10);
        }

        const placeModels = [
            { model: TrainStation, type: 'TrainStation' },
            { model: Airport, type: 'Airport' },
            { model: Port, type: 'Port' },
            { model: Destination, type: 'Destination' }
        ];

        let results = [];

        for (const { model, type } of placeModels) {
            const isMany = (type === 'Airport' || type === 'Port');
            const cityAlias = isMany ? 'cities' : 'city';

            const cityInclude = {
                model: City,
                as: cityAlias,
                required: true,
                include: [{ model: Nation, as: 'nation' }]
            };

            if (cityName && cityName.trim() !== "") {
                cityInclude.where = {
                    name: { [Op.like]: `%${cityName}%` }
                };
            }

            const queryOptions = {
                include: [cityInclude]
            };

            if (parsedLimit) {
                queryOptions.limit = parsedLimit - results.length;
                if (queryOptions.limit <= 0) break;
            }

            const places = await model.findAll(queryOptions);

            for (const place of places) {
                let placeCityName = 'Unknown';
                let placeNationName = 'Unknown';

                if (isMany) {
                    if (place.cities && place.cities.length > 0) {
                        placeCityName = place.cities.map(c => c.name).join(', ');
                        placeNationName = place.cities[0].nation ? place.cities[0].nation.name : 'Unknown';
                    }
                } else {
                    if (place.city) {
                        placeCityName = place.city.name;
                        placeNationName = place.city.nation ? place.city.nation.name : 'Unknown';
                    }
                }

                results.push({
                    id: encodeId(place.id, type),
                    street: place.street,
                    city: placeCityName,
                    nation: placeNationName
                });
            }

            if (parsedLimit && results.length >= parsedLimit) break;
        }

        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
