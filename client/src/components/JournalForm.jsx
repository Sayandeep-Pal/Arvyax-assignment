import { useState } from "react";
import { createEntry } from "../services/api";

const AMBIENCES = ["forest", "ocean", "mountain"];

/**
 * Form component for submitting a new journal entry.
 *
 * Props:
 * - userId    {string}   The current user identifier.
 * - onCreated {Function} Called with the newly created entry after a successful POST.
 */
export default function JournalForm({ userId, onCreated }) {
  const [ambience, setAmbience] = useState("forest");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const entry = await createEntry({ userId, ambience, text: text.trim() });
      onCreated(entry);
      setText("");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save entry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="journal-form" onSubmit={handleSubmit}>
      <h2>New Journal Entry</h2>

      <label>
        Ambience
        <select value={ambience} onChange={(e) => setAmbience(e.target.value)}>
          {AMBIENCES.map((a) => (
            <option key={a} value={a}>
              {a.charAt(0).toUpperCase() + a.slice(1)}
            </option>
          ))}
        </select>
      </label>

      <label>
        How are you feeling?
        <textarea
          rows={5}
          placeholder="Write about your session…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
        />
      </label>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save Entry"}
      </button>
    </form>
  );
}
