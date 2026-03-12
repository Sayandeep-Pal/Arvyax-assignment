import mongoose from "mongoose";

const analysisSchema = new mongoose.Schema(
  {
    emotion: { type: String, required: true },
    keywords: [{ type: String }],
    summary: { type: String, required: true },
  },
  { _id: false }
);

const journalEntrySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    ambience: {
      type: String,
      required: true,
      enum: ["forest", "ocean", "mountain"],
    },
    text: {
      type: String,
      required: true,
      minlength: 1,
    },
    analysis: {
      type: analysisSchema,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("JournalEntry", journalEntrySchema);
