import React, { useState, useEffect } from "react";
import { updateProfile } from "../api/user";
import "./ProfileEdit.css";

const ProfileEdit = ({ user, token, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: user?.name || "",
    avatar: user?.avatar || "",
    bio: user?.bio || "",
    subjects: user?.subjects?.join(", ") || "",
    hourlyRate: user?.hourlyRate || "",
    expertise: user?.expertise?.join(", ") || "",
    availability: user?.availability?.join(", ") || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || "");
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    setAvatarPreview(user?.avatar || "");
    setFormData({
      name: user?.name || "",
      avatar: user?.avatar || "",
      bio: user?.bio || "",
      subjects: user?.subjects?.join(", ") || "",
      hourlyRate: user?.hourlyRate || "",
      expertise: user?.expertise?.join(", ") || "",
      availability: user?.availability?.join(", ") || "",
    });
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size should be less than 5MB");
      return;
    }

    setUploadingImage(true);
    setError("");

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setAvatarPreview(base64String);
        setFormData((prev) => ({ ...prev, avatar: base64String }));
        setUploadingImage(false);
      };
      reader.onerror = () => {
        setError("Failed to read image file");
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("Failed to upload image");
      setUploadingImage(false);
    }
  };

  useEffect(() => {
    if (formData.avatar && formData.avatar.startsWith("data:image")) {
      setAvatarPreview(formData.avatar);
    }
  }, [formData.avatar]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const profileData = {
        name: formData.name,
        avatar: formData.avatar,
        bio: formData.bio,
      };

      // Add tutor-specific fields
      if (user?.role === "tutor") {
        profileData.subjects = formData.subjects
          ? formData.subjects.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
        profileData.hourlyRate = formData.hourlyRate ? Number(formData.hourlyRate) : undefined;
        profileData.expertise = formData.expertise
          ? formData.expertise.split(",").map((e) => e.trim()).filter(Boolean)
          : [];
        profileData.availability = formData.availability
          ? formData.availability.split(",").map((a) => a.trim()).filter(Boolean)
          : [];
      }

      await updateProfile(user._id, profileData, token);
      if (onSave) {
        onSave();
      }
    } catch (err) {
      setError(err.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-edit">
      <h2>Edit Profile</h2>
      <form onSubmit={handleSubmit} className="profile-form">
        <div className="form-group">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="avatar">Avatar</label>
          <div className="avatar-upload-section">
            <div className="avatar-preview">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar preview" className="avatar-preview-img" />
              ) : (
                <div className="avatar-placeholder">👤</div>
              )}
            </div>
            <div className="avatar-upload-controls">
              <label htmlFor="avatar-upload" className="upload-btn">
                {uploadingImage ? "Uploading..." : "Upload Image"}
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: "none" }}
                disabled={uploadingImage}
              />
              <input
                id="avatar-url"
                type="text"
                name="avatar"
                value={formData.avatar}
                onChange={handleChange}
                placeholder="Or enter emoji/URL"
                className="avatar-url-input"
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="bio">Bio</label>
          <textarea
            id="bio"
            name="bio"
            value={formData.bio}
            onChange={handleChange}
            rows="4"
            placeholder="Tell us about yourself..."
          />
        </div>

        {user?.role === "tutor" && (
          <>
            <div className="form-group">
              <label htmlFor="subjects">Subjects (comma-separated)</label>
              <input
                id="subjects"
                type="text"
                name="subjects"
                value={formData.subjects}
                onChange={handleChange}
                placeholder="Math, Science, English"
              />
            </div>

            <div className="form-group">
              <label htmlFor="hourlyRate">Hourly Rate ($)</label>
              <input
                id="hourlyRate"
                type="number"
                name="hourlyRate"
                value={formData.hourlyRate}
                onChange={handleChange}
                min="0"
                step="0.01"
              />
            </div>

            <div className="form-group">
              <label htmlFor="expertise">Expertise (comma-separated)</label>
              <input
                id="expertise"
                type="text"
                name="expertise"
                value={formData.expertise}
                onChange={handleChange}
                placeholder="Algebra, Calculus, Geometry"
              />
            </div>

            <div className="form-group">
              <label htmlFor="availability">Availability (comma-separated)</label>
              <input
                id="availability"
                type="text"
                name="availability"
                value={formData.availability}
                onChange={handleChange}
                placeholder="Monday-Friday, Weekends"
              />
            </div>
          </>
        )}

        {error && <div className="error-message">{error}</div>}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileEdit;

