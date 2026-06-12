import "./EmployeeProfileHeader.css";
import { useState } from "react";
import toast from "react-hot-toast";
import { apiRequest, getFileUrl } from "../../services/api";
import { Pencil, Power, Mail, Phone, CalendarDays, UserCheck, Star, Trash2, Upload } from "lucide-react";
import type { Employee, Role } from "../../types";
import { formatDateLabel } from "../../utils/format";
import AvatarUploadModal from "./AvatarUploadModal";

type EmployeeProfileHeaderProps = {
  employee: Employee;
  role: Role;
  currentEmployeeId: number | null;
  token: string | null;
  onEdit: () => void;
  onToggleStatus: () => void | Promise<void>;
  onAvatarChange: () => void;
};

function getStatusLabel(employee: Employee) {
  return employee.isActive ? employee.employmentStatus : "INACTIVE";
}

function getStatusClass(status: string) {
  return `status-pill status-pill--${status.toLowerCase().replace(/_/g, "-")}`;
}

export default function EmployeeProfileHeader({
  employee,
  role,
  currentEmployeeId,
  token,
  onEdit,
  onToggleStatus,
  onAvatarChange,
}: EmployeeProfileHeaderProps) {
  const [uploading, setUploading] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const initials = `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`.toUpperCase();
  const canManageEmployee = role === "ADMIN" || role === "HR";
  const canEditAvatar = role === "ADMIN" || role === "HR" || currentEmployeeId === employee.id;

  async function handleAvatarSave(file: File) {
    const formData = new FormData();
    formData.append("avatar", file);

    setUploading(true);
    try {
      await apiRequest(`/employees/${employee.id}/avatar`, {
        method: "POST",
        token,
        body: formData,
      });
      toast.success("Profile picture updated successfully!");
      setAvatarModalOpen(false);
      onAvatarChange();
    } catch (err: any) {
      toast.error(err.message || "Failed to upload profile picture.");
    } finally {
      setUploading(false);
    }
  }

  async function handleAvatarDelete() {
    if (!window.confirm("Are you sure you want to remove your profile picture?")) {
      return;
    }

    setUploading(true);
    try {
      await apiRequest(`/employees/${employee.id}/avatar`, {
        method: "DELETE",
        token,
      });
      toast.success("Profile picture removed successfully.");
      onAvatarChange();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove profile picture.");
    } finally {
      setUploading(false);
    }
  }

  const contactItems = [
    { icon: <Mail size={14} />, label: "Email", value: employee.user?.email ?? "-" },
    { icon: <Phone size={14} />, label: "Phone", value: employee.phone || "-" },
    { icon: <CalendarDays size={14} />, label: "Joined", value: formatDateLabel(employee.joiningDate) },
    { icon: <UserCheck size={14} />, label: "Manager", value: employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : "-" },
  ];

  return (
    <article className="card profile-header">
      {/* Top section: Avatar + Identity + Actions */}
      <div className="profile-header__top">
        <div className="profile-header__avatar-wrap">
          <div className="profile-header__avatar" aria-hidden="true">
            {employee.profilePictureUrl ? (
              <img
                src={getFileUrl(employee.profilePictureUrl) || ""}
                alt={`${employee.firstName} ${employee.lastName}`}
                className="profile-header__avatar-image"
              />
            ) : (
              initials
            )}
          </div>
          {canEditAvatar && (
            <div className="profile-header__avatar-btn-row">
              <button
                type="button"
                className={`profile-header__avatar-btn ${employee.profilePictureUrl ? 'profile-header__avatar-btn--edit' : 'profile-header__avatar-btn--upload'}`}
                onClick={() => setAvatarModalOpen(true)}
                title={employee.profilePictureUrl ? "Update photo" : "Upload photo"}
                disabled={uploading}
              >
                {employee.profilePictureUrl ? <Pencil size={14} /> : <Upload size={14} />}
              </button>
              {employee.profilePictureUrl && (
                <button
                  type="button"
                  className="profile-header__avatar-btn profile-header__avatar-btn--delete"
                  onClick={handleAvatarDelete}
                  title="Remove photo"
                  disabled={uploading}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="profile-header__identity">
          <div className="profile-header__name-row">
            <h2>{`${employee.firstName} ${employee.lastName}`}</h2>
            <div className="profile-header__badges">
              <span className={getStatusClass(getStatusLabel(employee))}>{getStatusLabel(employee)}</span>
              {employee.isOnProbation ? <span className="status-pill status-pill--pending">ON PROBATION</span> : null}
            </div>
          </div>
          <div className="profile-header__meta">
            <span className="profile-header__meta-chip mono">{employee.employeeCode}</span>
            <span className="profile-header__meta-divider" />
            <span className="profile-header__meta-chip">{employee.user?.role.name ?? "-"}</span>
            <span className="profile-header__meta-divider" />
            <span className="profile-header__meta-chip">{employee.department?.name ?? "-"}</span>
            {employee.jobTitle && (
              <>
                <span className="profile-header__meta-divider" />
                <span className="profile-header__meta-chip">{employee.jobTitle}</span>
              </>
            )}
          </div>
          {(employee.points != null && employee.points > 0) && (
            <span className="profile-header__points-badge">
              <Star size={11} fill="currentColor" />
              {employee.points} pts
            </span>
          )}
        </div>

        <div className="profile-header__actions">
          {employee.user?.email && (
            <a
              href={`https://chat.google.com/dm/${employee.user.email}`}
              target="_blank"
              rel="noopener noreferrer"
              className="profile-header__action-btn profile-header__action-btn--chat"
            >
              <img
                src="/assets/images/google-chat-icon.jpg"
                alt=""
                className="profile-header__chat-icon"
              />
              <span>Chat</span>
            </a>
          )}
          {canManageEmployee && (
            <>
              <button type="button" className="profile-header__action-btn profile-header__action-btn--primary" onClick={onEdit}>
                <Pencil size={15} />
                <span>Edit</span>
              </button>
              <button type="button" className="profile-header__action-btn profile-header__action-btn--secondary" onClick={onToggleStatus}>
                <Power size={15} />
                <span>{employee.isActive ? "Deactivate" : "Activate"}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bottom section: Contact info chips */}
      <div className="profile-header__contact-strip">
        {contactItems.map((item) => (
          <div key={item.label} className="profile-header__contact-item">
            <div className="profile-header__contact-icon">{item.icon}</div>
            <div className="profile-header__contact-copy">
              <span className="profile-header__contact-label">{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          </div>
        ))}
      </div>
      <AvatarUploadModal
        open={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        onSave={handleAvatarSave}
        uploading={uploading}
      />
    </article>
  );
}
