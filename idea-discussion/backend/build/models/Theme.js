import mongoose, { Schema } from "mongoose";
const themeSchema = new Schema({
    title: {
        type: String,
        required: true,
        unique: true,
    },
    description: {
        type: String,
        required: false,
    },
    slug: {
        type: String,
        required: true,
        unique: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true });
const Theme = mongoose.model("Theme", themeSchema);
export default Theme;
//# sourceMappingURL=Theme.js.map