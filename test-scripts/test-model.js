const { Nation, City, TrainStation, Airport, Port, Destination, TransportRequest } = require('./models');

async function test() {
    try {
        // Create sample data
        const france = await Nation.create({ name: 'France' });
        const paris = await City.create({ name: 'Paris', postcode: '75000', nationId: france.id });
        const lyon = await City.create({ name: 'Lyon', postcode: '69000', nationId: france.id });

        const gareLyon = await TrainStation.create({ 
            street: 'Place Louis-Armand', 
            cityId: paris.id,
            storage: { PACKAGE: 0, STANDARD: 0, WIDE_LOAD: 0, EMPTY: 0 }
        });

        const destLyon = await Destination.create({
            street: 'Rue de la République',
            cityId: lyon.id
        });

        console.log('Sample data created.');

        // Verify finding them as generic places
        const findPlace = async (id) => {
            const types = ['TrainStation', 'Airport', 'Port', 'Destination'];
            const models = { TrainStation, Airport, Port, Destination };
            for (const type of types) {
                const p = await models[type].findByPk(id);
                if (p) return { id: p.id, type };
            }
            return null;
        };

        const fromPlace = await findPlace(gareLyon.id);
        const toPlace = await findPlace(destLyon.id);

        console.log('Resolved from:', fromPlace);
        console.log('Resolved to:', toPlace);

        if (fromPlace && toPlace) {
            const tr = await TransportRequest.create({
                loadType: 'PACKAGE',
                quantity: 10,
                requestedAt: new Date(),
                fromId: fromPlace.id,
                fromType: fromPlace.type,
                toId: toPlace.id,
                toType: toPlace.type
            });
            console.log('TransportRequest created:', tr.toJSON());
        }

    } catch (e) {
        console.error('Test failed:', e);
    } finally {
        process.exit();
    }
}

test();
