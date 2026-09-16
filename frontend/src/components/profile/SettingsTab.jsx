import React from "react";

export default function SettingsTab({
  profile,
  editName,
  setEditName,
  editPhone,
  setEditPhone,
  editBio,
  setEditBio,
  settingsErr,
  setSettingsErr,
  handleSaveSettings,
  setModal,
  showToast,
}) {
  return (
    <div className="section-card">
      <div className="section-card-header">
        <div className="section-card-title">
          <span className="section-card-title-icon">⚙️</span> Account Settings
        </div>
      </div>
      <div className="settings-grid">
        <div className="settings-field">
          <label htmlFor="settingsFullName">Full Name</label>
          <input
            id="settingsFullName"
            className={`field-value editable${settingsErr && !editName.trim() ? " input-error" : ""}`}
            value={editName}
            onChange={(e) => { setEditName(e.target.value); setSettingsErr(""); }}
            placeholder="Your name"
          />
        </div>
        <div className="settings-field">
          <label>Email Address</label>
          <div className="field-value">{profile.email}</div>
        </div>
        <div className="settings-field">
          <label htmlFor="settingsPhone">Phone Number</label>
          <input
            id="settingsPhone"
            className="field-value editable"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            placeholder="+91 00000 00000"
          />
        </div>
        <div className="settings-field">
          <label>Member Since</label>
          <div className="field-value">
            {profile.createdAt
              ? new Date(profile.createdAt).toLocaleDateString("en-US", {
                year: "numeric", month: "long", day: "numeric",
              })
              : "—"}
          </div>
        </div>
        <div className="settings-field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="settingsBio">Bio / About</label>
          <textarea
            id="settingsBio"
            className="field-value editable"
            rows={3}
            value={editBio}
            onChange={(e) => setEditBio(e.target.value)}
            placeholder="Tell clients a bit about yourself…"
            style={{ resize: "vertical", lineHeight: 1.6 }}
            maxLength={500}
          />
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            {editBio.length}/500
          </span>
        </div>

        {settingsErr && (
          <div style={{ gridColumn: "1 / -1", color: "#ef4444", fontSize: 14, padding: "4px 0" }}>
            ⚠ {settingsErr}
          </div>
        )}

        <div className="settings-divider" />
        <div className="settings-save-row">
          <button
            className="btn-cancel-settings"
            onClick={() => {
              setEditName(profile.name || "");
              setEditBio(profile.bio || "");
              setEditPhone(profile.phone || "");
              setSettingsErr("");
            }}
          >
            Cancel
          </button>
          <button className="btn-save" onClick={handleSaveSettings}>
            Save Changes
          </button>
        </div>

        <div className="settings-danger-zone">
          <div className="danger-zone-info">
            <div className="dz-title">Delete Account</div>
            <div className="dz-sub">
              Permanently delete your account and all data. This cannot be undone.
            </div>
          </div>
          <button
            className="btn-danger"
            onClick={() =>
              setModal({
                type: "danger",
                title: "Delete your account?",
                body: "This is permanent. All your gigs, bids, and data will be lost forever.",
                confirmLabel: "Delete Account",
                onConfirm: () => showToast("Please contact support to delete your account.", "error"),
              })
            }
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
