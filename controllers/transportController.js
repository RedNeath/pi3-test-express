const { Place, City, Nation, TransportMean, mongoose } = require('../models');
const logger = require('../utils/logger');

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

const formatPlace = async (id, type) => {
    const place = await Place.findById(id).populate({
        path: 'cityId',
        populate: { path: 'nationId' }
    }).populate({
        path: 'cities',
        populate: { path: 'nationId' }
    });

    if (!place) return null;

    let cityName = 'Unknown';
    let nationName = 'Unknown';

    if (type === 'Airport' || type === 'Port') {
        if (place.cities && place.cities.length > 0) {
            cityName = place.cities.map(c => c.name).join(', ');
            nationName = place.cities[0].nationId ? place.cities[0].nationId.name : 'Unknown';
        }
    } else {
        if (place.cityId) {
            cityName = place.cityId.name;
            nationName = place.cityId.nationId ? place.cityId.nationId.name : 'Unknown';
        }
    }

    return {
        id: encodeId(place._id, type),
        street: place.street,
        city: cityName,
        nation: nationName
    };
};

const getPossibleVehicleTypes = (fromType, toType, loadType) => {
    const types = [];
    const compatibility = {
        'LocalServing': ['PACKAGE'],
        'Lorry': ['PACKAGE', 'STANDARD', 'WIDE_LOAD'],
        'Train': ['STANDARD', 'WIDE_LOAD'],
        'Plane': ['PACKAGE', 'STANDARD'],
        'Ship': ['PACKAGE', 'STANDARD', 'WIDE_LOAD']
    };

    if (fromType === 'TrainStation' && toType === 'TrainStation') {
        if (compatibility['Train'].includes(loadType)) types.push('Train');
    }
    if (fromType === 'Airport' && toType === 'Airport') {
        if (compatibility['Plane'].includes(loadType)) types.push('Plane');
    }
    if (fromType === 'Port' && toType === 'Port') {
        if (compatibility['Ship'].includes(loadType)) types.push('Ship');
    }
    if (compatibility['Lorry'].includes(loadType.toUpperCase())) types.push('Lorry');
    if (compatibility['LocalServing'].includes(loadType.toUpperCase())) types.push('LocalServing');
    
    return [...new Set(types)];
};

exports.createTransportRequest = async (req, res) => {
    const startTime = Date.now();
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { from, to, loadType, quantity, requestedAt } = req.body;
        
        const fromInfo = decodeId(from.id);
        const toInfo = decodeId(to.id);

        if (!fromInfo || !toInfo) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ error: 'Invalid from or to place ID format' });
        }

        const fromPlace = await Place.findById(fromInfo.id).populate('cityId').populate('cities').session(session);
        const toPlace = await Place.findById(toInfo.id).populate('cityId').populate('cities').session(session);

        if (!fromPlace || !toPlace) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ error: 'Invalid from or to place ID' });
        }

        const getPlaceCityName = (place) => {
            if (place.type === 'TrainStation' || place.type === 'Destination') {
                return place.cityId ? place.cityId.name : 'Inconnue';
            } else {
                return (place.cities && place.cities.length > 0) ? place.cities[0].name : 'Inconnue';
            }
        };

        logger.info(`Nouvelle demande de transport reçue à ${requestedAt || new Date().toISOString()}`, { 
            req,
            details: {
                fromCity: getPlaceCityName(fromPlace),
                toCity: getPlaceCityName(toPlace),
                loadType,
                quantity
            }
        });

        const possibleVehicleTypes = getPossibleVehicleTypes(fromPlace.type, toPlace.type, loadType);

        if (possibleVehicleTypes.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ error: `No vehicle type compatible with load type ${loadType} for this route.` });
        }

        let remainingQuantity = quantity;
        const selectedVehicles = [];

        const findAndAssignVehicles = async (locationId, locationType, isSource) => {
            while (remainingQuantity > 0) {
                let query = {
                    type: { $in: possibleVehicleTypes },
                    load: 0,
                    _id: { $nin: selectedVehicles.map(v => v._id) }
                };

                if (isSource) {
                    query.locationId = locationId;
                    query.locationType = locationType;
                }

                const v = await TransportMean.findOne(query).session(session);

                if (!v) break;

                if (!isSource) {
                    const oldLocationId = v.locationId;
                    const oldLocationType = v.locationType;
                    v.locationId = fromPlace._id;
                    v.locationType = fromPlace.type;
                    await v.save({ session });
                    logger.info(`Déplacement à vide du véhicule [${v.type} ID:${v._id}] de [${oldLocationType} ID:${oldLocationId}] vers [${fromPlace.type} ID:${fromPlace._id}]`);
                }

                const loadForThisVehicle = Math.min(remainingQuantity, v.capacity);
                v.assignedLoad = loadForThisVehicle;
                selectedVehicles.push(v);
                remainingQuantity -= loadForThisVehicle;
            }
        };

        await findAndAssignVehicles(fromPlace._id, fromPlace.type, true);

        if (remainingQuantity > 0) {
            await findAndAssignVehicles(null, null, false);
        }

        if (remainingQuantity > 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ 
                error: `Insufficient fleet capacity. Remaining quantity: ${remainingQuantity} after assigning ${selectedVehicles.length} vehicles.` 
            });
        }

        // Pick up
        try {
            await fromPlace.pickUp(loadType, quantity);
        } catch (e) {
            logger.warn(`PickUp failed: ${e.message}`);
        }

        for (const vehicle of selectedVehicles) {
            vehicle.loadType = loadType;
            vehicle.load = vehicle.assignedLoad;
            vehicle.locationId = toPlace._id;
            vehicle.locationType = toPlace.type;
            await vehicle.save({ session });
            
            logger.info(`Transport de marchandise [${loadType} x${vehicle.load}] par [${vehicle.type} ID:${vehicle._id}] de [${fromPlace.type} ID:${fromPlace._id}] vers [${toPlace.type} ID:${toPlace._id}]`);

            await toPlace.deliver(loadType, vehicle.load);
            
            vehicle.load = 0;
            vehicle.loadType = 'EMPTY';
            await vehicle.save({ session });
        }

        const response = {
            id: require('crypto').randomUUID(),
            from: await formatPlace(fromPlace._id, fromPlace.type),
            to: await formatPlace(toPlace._id, toPlace.type),
            loadType: loadType,
            quantity: quantity,
            status: 'COMPLETED',
            requestedAt: requestedAt,
            updatedAt: new Date().toISOString(),
            transportMeanId: selectedVehicles.length === 1 ? selectedVehicles[0]._id.toString() : selectedVehicles.map(v => v._id).join(', ')
        };

        await session.commitTransaction();
        session.endSession();

        const responseTime = Date.now() - startTime;
        logger.info(`Réponse envoyée en ${responseTime}ms`);

        res.status(201).json(response);
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error: ' + error.message });
    }
};

exports.getPlaces = async (req, res) => {
    try {
        const { cityName, limit } = req.query;
        let parsedLimit = 100;
        if (limit && limit.trim() !== "") {
            parsedLimit = parseInt(limit, 10);
        }

        let query = {};
        if (cityName && cityName.trim() !== "") {
            const cities = await City.find({ name: { $regex: cityName, $options: 'i' } });
            const cityIds = cities.map(c => c._id);
            query = {
                $or: [
                    { cityId: { $in: cityIds } },
                    { cities: { $in: cityIds } }
                ]
            };
        }

        const places = await Place.find(query)
            .limit(parsedLimit)
            .populate({
                path: 'cityId',
                populate: { path: 'nationId' }
            })
            .populate({
                path: 'cities',
                populate: { path: 'nationId' }
            });

        const results = places.map(place => {
            let placeCityName = 'Unknown';
            let placeNationName = 'Unknown';

            if (place.type === 'Airport' || place.type === 'Port') {
                if (place.cities && place.cities.length > 0) {
                    placeCityName = place.cities.map(c => c.name).join(', ');
                    placeNationName = place.cities[0].nationId ? place.cities[0].nationId.name : 'Unknown';
                }
            } else {
                if (place.cityId) {
                    placeCityName = place.cityId.name;
                    placeNationName = place.cityId.nationId ? place.cityId.nationId.name : 'Unknown';
                }
            }

            return {
                id: encodeId(place._id, place.type),
                street: place.street,
                city: placeCityName,
                nation: placeNationName
            };
        });

        res.json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
