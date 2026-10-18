import mongoose from "mongoose";

// Google Meet の会議1回分の記録（文字起こしと録画の場所）。
// Meet REST API の conferenceRecords 1件に対応する。お題と一緒に自動削除する

const transcriptEntrySchema = new mongoose.Schema(
  {
    speaker: { type: String, default: "" },
    text: { type: String, default: "" },
    startTime: { type: Date, default: null },
  },
  { _id: false }
);

const transcriptSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    // STARTED / ENDED / FILE_GENERATED
    state: { type: String, default: "" },
    docsUrl: { type: String, default: "" },
    entries: { type: [transcriptEntrySchema], default: [] },
  },
  { _id: false }
);

const recordingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    state: { type: String, default: "" },
    driveFileId: { type: String, default: "" },
    url: { type: String, default: "" },
  },
  { _id: false }
);

const kaigiMeetRecordSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KaigiRoom",
      required: true,
      index: true,
    },
    // conferenceRecords/{id}
    conferenceRecord: { type: String, required: true, unique: true },
    startTime: { type: Date, default: null },
    endTime: { type: Date, default: null },
    transcripts: { type: [transcriptSchema], default: [] },
    recordings: { type: [recordingSchema], default: [] },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

kaigiMeetRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const KaigiMeetRecord = mongoose.model(
  "KaigiMeetRecord",
  kaigiMeetRecordSchema
);

export default KaigiMeetRecord;
