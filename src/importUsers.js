import fs from 'fs';
import csv from 'csv-parser';
import { MongoClient } from 'mongodb';
import { MONGO_URI } from '../env.js';
import { createUserModel } from './models/userModel.js';

const csvFilePath = './users.csv';

async function importUsers() {
    console.log("🚀 Starting user import...");

    const usersToImport = [];
    const client = new MongoClient(MONGO_URI);

    // Read the CSV file
    fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
            // This assumes your CSV columns are named exactly like this.
            // Adjust the row['Column Name'] if your form has different question titles.
            const userData = {
                name: row['Name'],
                email: row['Email'],
                desiredRoles: row['Desired Role'] ? row['Desired Role'].split(',').map(r => r.trim()) : [],
                yearsOfExperience: row['Number of Years of Experience'],
                desiredDomains: row['Desired Domain'] ? row['Desired Domain'].split(',').map(d => d.trim()) : [],
            };
            
            // Use our model to create a clean, validated user object
            const user = createUserModel(userData);

            // Add a filter for the update operation
            const operation = {
                updateOne: {
                    filter: { email: user.email }, // Use email as the unique key
                    update: { $set: user },         // Update the user data
                    upsert: true                    // Insert if the user doesn't exist
                }
            };

            usersToImport.push(operation);
        })
        .on('end', async () => {
            if (usersToImport.length === 0) {
                console.log("No users found in CSV to import.");
                return;
            }

            console.log(`Found ${usersToImport.length} users. Connecting to database to save...`);
            
            try {
                await client.connect();
                const db = client.db("job-scraper");
                const usersCollection = db.collection('users');

                // Use bulkWrite to efficiently upsert all users
                await usersCollection.bulkWrite(usersToImport);

                console.log(`✅ Successfully imported or updated ${usersToImport.length} users.`);
            } catch (err) {
                console.error("❌ Error during database operation:", err);
            } finally {
                await client.close();
                console.log("Database connection closed.");
            }
        });
}

importUsers();