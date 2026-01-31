const { Nation, City, Place, TransportMean, connectDB, mongoose } = require('./models');

async function seedBulk() {
    // Suppression de l'appel à connectDB() ici car il est déjà fait dans db-init.js
    
    const nationsData = [
        { name: 'France', cities: ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Lille', 'Strasbourg', 'Nantes', 'Toulouse', 'Nice', 'Montpellier', 'Rennes', 'Grenoble'] },
        { name: 'Spain', cities: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Malaga', 'Murcia', 'Palma', 'Las Palmas', 'Bilbao', 'Alicante', 'Cordoba'] },
        { name: 'Germany', cities: ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dortmund', 'Essen', 'Bremen', 'Dresden'] },
        { name: 'Italy', cities: ['Rome', 'Milan', 'Naples', 'Turin', 'Palermo', 'Genoa', 'Bologna', 'Florence', 'Bari', 'Catania', 'Venice', 'Verona'] },
        { name: 'United Kingdom', cities: ['London', 'Birmingham', 'Glasgow', 'Liverpool', 'Bristol', 'Manchester', 'Sheffield', 'Leeds', 'Edinburgh', 'Leicester', 'Coventry', 'Belfast'] },
        { name: 'Belgium', cities: ['Brussels', 'Antwerp', 'Ghent', 'Charleroi', 'Liège', 'Bruges', 'Namur', 'Leuven', 'Mons', 'Aalst', 'Mechelen', 'La Louvière'] },
        { name: 'Netherlands', cities: ['Amsterdam', 'Rotterdam', 'The Hague', 'Utrecht', 'Eindhoven', 'Tilburg', 'Groningen', 'Almere', 'Breda', 'Nijmegen', 'Enschede', 'Apeldoorn'] },
        { name: 'Portugal', cities: ['Lisbon', 'Porto', 'Amadora', 'Braga', 'Setúbal', 'Coimbra', 'Queluz', 'Funchal', 'Cacém', 'Vila Nova de Gaia', 'Algueirão-Mem Martins', 'Loures'] },
        { name: 'Switzerland', cities: ['Zurich', 'Geneva', 'Basel', 'Lausanne', 'Bern', 'Winterthur', 'Lucerne', 'St. Gallen', 'Lugano', 'Biel/Bienne', 'Thun', 'Köniz'] },
        { name: 'Austria', cities: ['Vienna', 'Graz', 'Linz', 'Salzburg', 'Innsbruck', 'Klagenfurt', 'Villach', 'Wels', 'Sankt Pölten', 'Dornbirn', 'Wiener Neustadt', 'Steyr'] }
    ];

    const streetNames = ['Rue de la Paix', 'Avenue des Champs-Élysées', 'Boulevard Haussmann', 'Rue de Rivoli', 'Avenue Victor Hugo', 'Rue de la Pompe', 'Place de la Concorde', 'Rue Lafayette', 'Avenue Foch', 'Boulevard Saint-Michel'];
    const stationSuffixes = ['Gare Centrale', 'Gare du Nord', 'Gare du Sud', 'Gare de l\'Est', 'Gare de l\'Ouest'];
    const airportSuffixes = ['International Airport', 'Regional Airport', 'Airfield', 'Terminal A'];
    const portSuffixes = ['Port de Commerce', 'Marina', 'Quai des Brumes', 'Terminal de Conteneurs'];

    let allCities = [];
    for (const nationInfo of nationsData) {
        let nation = await Nation.findOne({ name: nationInfo.name });
        if (!nation) {
            nation = await Nation.create({ name: nationInfo.name });
        }
        for (const cityName of nationInfo.cities) {
            let city = await City.findOne({ name: cityName, nationId: nation._id });
            if (!city) {
                city = await City.create({
                    name: cityName,
                    postcode: `${Math.floor(10000 + Math.random() * 89999)}`,
                    nationId: nation._id
                });
            }
            allCities.push(city);
        }
    }
    console.log(`${allCities.length} villes traitées.`);

    const transitoryPlaces = {
        trainStations: [],
        airports: [],
        ports: []
    };
    const allPlaces = [];

    for (const city of allCities) {
        for (let i = 1; i <= 5; i++) {
            const rand = Math.random();
            let place;
            const street = streetNames[Math.floor(Math.random() * streetNames.length)] + ' ' + (Math.floor(Math.random() * 200) + 1);
            
            if (rand < 0.1) { // 10% TrainStation
                const stationName = `${city.name} ${stationSuffixes[Math.floor(Math.random() * stationSuffixes.length)]}`;
                place = await Place.create({ street: `${stationName}, ${street}`, storage: {}, cityId: city._id, type: 'TrainStation' });
                transitoryPlaces.trainStations.push(place);
            } else if (rand < 0.15) { // 5% Airport
                const airportName = `${city.name} ${airportSuffixes[Math.floor(Math.random() * airportSuffixes.length)]}`;
                place = await Place.create({ street: `${airportName}, ${street}`, storage: {}, cityId: city._id, type: 'Airport', cities: [city._id] });
                transitoryPlaces.airports.push(place);
            } else if (rand < 0.20) { // 5% Port
                const portName = `${city.name} ${portSuffixes[Math.floor(Math.random() * portSuffixes.length)]}`;
                place = await Place.create({ street: `${portName}, ${street}`, storage: {}, cityId: city._id, type: 'Port', cities: [city._id] });
                transitoryPlaces.ports.push(place);
            } else { // 80% Destination
                place = await Place.create({ street: street, cityId: city._id, type: 'Destination' });
            }
            
            allPlaces.push({ id: place._id, type: place.type });
        }
    }
    console.log(`Lieux créés. Gares: ${transitoryPlaces.trainStations.length}, Aéroports: ${transitoryPlaces.airports.length}, Ports: ${transitoryPlaces.ports.length}`);

    const allTransitory = [...transitoryPlaces.trainStations.map(p => ({id: p._id, type: 'TrainStation'})), 
                           ...transitoryPlaces.airports.map(p => ({id: p._id, type: 'Airport'})), 
                           ...transitoryPlaces.ports.map(p => ({id: p._id, type: 'Port'}))];

    console.log('Génération de la flotte...');

    const localServings = [];
    for (let i = 0; i < 1500; i++) {
        const loc = allPlaces[Math.floor(Math.random() * allPlaces.length)];
        const cap = 185 + Math.floor(Math.random() * 116);
        localServings.push({
            type: 'LocalServing',
            capacity: cap,
            load: 0,
            loadType: 'EMPTY',
            locationId: loc.id,
            locationType: loc.type
        });
    }
    await TransportMean.insertMany(localServings);
    console.log('1500 LocalServing créés.');

    const lorries = [];
    const lorryCaps = [1200, 1800, 2900];
    for (let i = 0; i < 200; i++) {
        const loc = allTransitory[Math.floor(Math.random() * allTransitory.length)];
        lorries.push({
            type: 'Lorry',
            capacity: lorryCaps[Math.floor(Math.random() * lorryCaps.length)],
            load: 0,
            loadType: 'EMPTY',
            locationId: loc.id,
            locationType: loc.type
        });
    }
    await TransportMean.insertMany(lorries);
    console.log('200 Lorry créés.');

    if (transitoryPlaces.trainStations.length > 0) {
        const trains = [];
        for (let i = 0; i < 50; i++) {
            const loc = transitoryPlaces.trainStations[Math.floor(Math.random() * transitoryPlaces.trainStations.length)];
            trains.push({
                type: 'Train',
                capacity: 34800,
                load: 0,
                loadType: 'EMPTY',
                locationId: loc._id,
                locationType: 'TrainStation'
            });
        }
        await TransportMean.insertMany(trains);
        console.log('50 Train créés.');
    }

    if (transitoryPlaces.airports.length > 0) {
        const planes = [];
        for (let i = 0; i < 5; i++) {
            const loc = transitoryPlaces.airports[Math.floor(Math.random() * transitoryPlaces.airports.length)];
            planes.push({
                type: 'Plane',
                capacity: 5600,
                load: 0,
                loadType: 'EMPTY',
                locationId: loc._id,
                locationType: 'Airport'
            });
        }
        await TransportMean.insertMany(planes);
        console.log('5 Plane créés.');
    }

    if (transitoryPlaces.ports.length > 0) {
        const ships = [];
        for (let i = 0; i < 10; i++) {
            const loc = transitoryPlaces.ports[Math.floor(Math.random() * transitoryPlaces.ports.length)];
            ships.push({
                type: 'Ship',
                capacity: 870000,
                load: 0,
                loadType: 'EMPTY',
                locationId: loc._id,
                locationType: 'Port'
            });
        }
        await TransportMean.insertMany(ships);
        console.log('10 Ship créés.');
    }
}

module.exports = seedBulk;
