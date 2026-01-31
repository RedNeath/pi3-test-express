const mongoose = require('mongoose');

const mongoUri = process.env.MONGO_URI || 'mongodb://db:27017/transport_db?replicaSet=rs0';

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) {
        console.log('Déjà connecté à MongoDB (readyState: ' + mongoose.connection.readyState + ')');
        return;
    }
    try {
        console.log('Appel à mongoose.connect avec URI:', mongoUri);
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
        });
        console.log('Connecté à MongoDB avec succès');
    } catch (err) {
        console.error('ERREUR FATALE connectDB:', err.message);
        throw err; // On relance pour que db-init le capture
    }
};

const NationSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }
}, { timestamps: true });

const CitySchema = new mongoose.Schema({
    name: { type: String, required: true },
    postcode: { type: String, required: true },
    nationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Nation', required: true }
}, { timestamps: true });

const PlaceSchema = new mongoose.Schema({
    street: { type: String, required: true },
    storage: { type: Map, of: Number, default: {} },
    cityId: { type: mongoose.Schema.Types.ObjectId, ref: 'City' },
    type: { type: String, enum: ['TrainStation', 'Airport', 'Port', 'Destination'], required: true },
    // For many-to-many Airports <-> Cities
    cities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'City' }]
}, { timestamps: true });

PlaceSchema.methods.getStoredQuantity = function(type) {
    if (type) {
        return this.storage.get(type) || 0;
    }
    let total = 0;
    for (let val of this.storage.values()) {
        total += val;
    }
    return total;
};

PlaceSchema.methods.pickUp = async function(type, quantity) {
    const current = this.storage.get(type) || 0;
    if (current >= quantity) {
        this.storage.set(type, current - quantity);
        await this.save();
    } else {
        throw new Error('Insufficient storage');
    }
};

PlaceSchema.methods.deliver = async function(type, quantity) {
    const current = this.storage.get(type) || 0;
    this.storage.set(type, current + quantity);
    await this.save();
};

const TransportMeanSchema = new mongoose.Schema({
    type: { type: String, required: true },
    capacity: { type: Number, required: true },
    load: { type: Number, default: 0 },
    loadType: { type: String, default: 'EMPTY' },
    locationId: { type: mongoose.Schema.Types.ObjectId, required: true },
    locationType: { type: String, required: true }
}, { timestamps: true });

const Nation = mongoose.models.Nation || mongoose.model('Nation', NationSchema);
const City = mongoose.models.City || mongoose.model('City', CitySchema);
const Place = mongoose.models.Place || mongoose.model('Place', PlaceSchema);
const TransportMean = mongoose.models.TransportMean || mongoose.model('TransportMean', TransportMeanSchema);

module.exports = {
    connectDB,
    Nation,
    City,
    Place,
    TransportMean,
    mongoose
};
