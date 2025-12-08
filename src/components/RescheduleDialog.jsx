import React, { useState } from "react";
import "./RescheduleDialog.css";

const RescheduleDialog = ({ session, onConfirm, onCancel }) => {
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!newDate || !newTime) {
      setError("Please select both date and time");
      return;
    }

    const newStartTime = new Date(`${newDate}T${newTime}`);
    const now = new Date();
    
    if (newStartTime <= now) {
      setError("Please select a future date and time");
      return;
    }

    onConfirm(newStartTime.toISOString());
  };

  // Set minimum date to today
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="reschedule-overlay" onClick={onCancel}>
      <div className="reschedule-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="reschedule-header">
          <h2>Reschedule Session</h2>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="reschedule-form">
          <div className="form-group">
            <label htmlFor="reschedule-date">New Date</label>
            <input
              id="reschedule-date"
              type="date"
              value={newDate}
              onChange={(e) => {
                setNewDate(e.target.value);
                setError("");
              }}
              min={today}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="reschedule-time">New Time</label>
            <input
              id="reschedule-time"
              type="time"
              value={newTime}
              onChange={(e) => {
                setNewTime(e.target.value);
                setError("");
              }}
              required
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="reschedule-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Confirm Reschedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RescheduleDialog;

