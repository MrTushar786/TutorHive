import React, { useState } from "react";
import "./FeedbackForm.css";

const FeedbackForm = ({ session, onSubmit, onCancel, isTutor = false }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        rating,
        comment,
        sessionId: session.id,
      });
    } catch (error) {
      console.error("Error submitting feedback:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="feedback-overlay">
      <div className="feedback-modal">
        <div className="feedback-header">
          <h2>Session Feedback</h2>
          <p>How was your session with {isTutor ? session.student : session.tutor}?</p>
        </div>
        <form onSubmit={handleSubmit} className="feedback-form">
          <div className="feedback-rating">
            <label>Rating</label>
            <div className="rating-stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`star-btn ${rating >= star ? "active" : ""}`}
                  onClick={() => setRating(star)}
                >
                  ⭐
                </button>
              ))}
            </div>
            <span className="rating-value">{rating} / 5</span>
          </div>
          <div className="feedback-comment">
            <label htmlFor="comment">Comments (Optional)</label>
            <textarea
              id="comment"
              rows="4"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your thoughts about the session..."
            />
          </div>
          <div className="feedback-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onCancel}
              disabled={submitting}
            >
              Skip
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Feedback"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeedbackForm;

