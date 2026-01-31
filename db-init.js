const { Nation, connectDB, mongoose } = require('./models');
const seedBulk = require('./seed-bulk-logic');

async function runInit() {
    console.log('--- Initialisation de la Base de Données MongoDB ---');
    try {
        console.log('Tentative de connexion à MongoDB...');
        await connectDB();
        
        console.log('Connexion établie. Vérification de la population...');
        const count = await Nation.countDocuments();
        if (count === 0) {
            console.log('Base de données vide. Population initiale...');
            await seedBulk();
            console.log('Population terminée.');
        } else {
            console.log('Base de données déjà peuplée.');
        }
        
        console.log('Initialisation terminée avec succès.');
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('ERREUR INITIALISATION DB :', error);
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
}

if (require.main === module) {
    runInit();
}

module.exports = runInit;
