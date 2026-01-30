const { Nation, City, TrainStation, Airport, Port, Destination } = require('./models');

async function seed() {
    try {
        const france = await Nation.create({ name: 'France' });
        const spain = await Nation.create({ name: 'Spain' });

        const paris = await City.create({ name: 'Paris', postcode: '75000', nationId: france.id });
        const madrid = await City.create({ name: 'Madrid', postcode: '28000', nationId: spain.id });
        const lyon = await City.create({ name: 'Lyon', postcode: '69000', nationId: france.id });

        await TrainStation.create({ street: 'Gare du Nord', storage: {}, cityId: paris.id });
        await TrainStation.create({ street: 'Atocha', storage: {}, cityId: madrid.id });
        
        await Airport.create({ street: 'CDG', storage: {}, cityId: paris.id });
        await Airport.create({ street: 'Barajas', storage: {}, cityId: madrid.id });

        await Port.create({ street: 'Port de Marseille', storage: {}, cityId: lyon.id }); // Lyon is not a port but for test...

        await Destination.create({ street: '123 Rue de Rivoli', cityId: paris.id });

        console.log('Seed successful');
    } catch (error) {
        console.error('Seed failed:', error);
    } finally {
        process.exit();
    }
}

seed();
