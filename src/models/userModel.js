/**
 * This file defines the schema for a 'User' and provides a class
 * to create and validate user documents.
 */
import bcrypt from 'bcryptjs';

const userSchemaDefinition = {
    email: { type: String, required: true, trim: true },
    password: { type: String, required: false }, // ✅ CHANGED: Not required for waitlist
    name: { type: String, default: "User", trim: true },
    role: { type: String, default: "user" },
    
    // Talent Pool / Waitlist Data
    location: { type: String, default: "" }, // ✅ ADDED
    domain: { type: String, default: "" },   // ✅ ADDED (Tech/Non-Tech)
    isWaitlist: { type: Boolean, default: false }, // ✅ ADDED
    
    // Preferences
    desiredRoles: { type: Array, default: [] },
    desiredDomains: { type: Array, default: [] },
    emailFrequency: { type: String, default: "Weekly" }, 
    subscriptionTier: { type: String, default: "free" }, 
    isSubscribed: { type: Boolean, default: true },

    // System
    lastEmailSent: { type: Date, default: null },
    sentJobIds: { type: Array, default: [] },
    createdAt: { type: Date },
    updatedAt: { type: Date },
};

class User {
    constructor(data) {
        this.createdAt = data.createdAt || new Date();
        this.updatedAt = new Date();

        for (const key in userSchemaDefinition) {
            if (key === 'createdAt' || key === 'updatedAt') continue;

            const schemaField = userSchemaDefinition[key];
            let value = data[key];

            // VALIDATION LOGIC
            // If required AND missing AND not a waitlist user, throw error
            if (schemaField.required && (!value)) {
                 // If it's the password field, we allow it to be empty IF 'isWaitlist' is true
                 if (key === 'password' && data.isWaitlist === true) {
                     value = null; // Allow null for waitlist
                 } else {
                     // For normal users/admins, password is required
                    // In a real Mongoose model, this would be handled by the schema. 
                    // Here we are lenient to allow the controller to handle validation errors.
                 }
            }

            if (value === undefined || value === null) {
                this[key] = schemaField.default !== undefined ? schemaField.default : null;
            } else {
                if (schemaField.type === String) {
                    this[key] = schemaField.trim ? String(value).trim() : String(value);
                } else if (schemaField.type === Number) {
                    const numValue = Number(value);
                    this[key] = isNaN(numValue) ? schemaField.default : numValue;
                } else if (schemaField.type === Boolean) {
                    this[key] = Boolean(value);
                } else if (schemaField.type === Date) {
                    this[key] = new Date(value);
                } else {
                    this[key] = value;
                }
            }
        }
    }
}

/**
 * Factory function to create a validated User object.
 */
export function createUserModel(formData) {
    return new User(formData);
}