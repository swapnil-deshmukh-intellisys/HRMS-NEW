import { useState, useEffect, useRef, useCallback } from "react";
import { type EmployeeDocument, type Role } from "../../types";
import { apiRequest, API_BASE_URL } from "../../services/api";
import { Upload, FolderOpen, FileText, Image as ImageIcon, File, Download, Trash2, Pencil } from "lucide-react";
import { formatBytes } from "../../utils/format";
import Modal from "../../components/common/Modal";
import toast from "react-hot-toast";
import "./EmployeeDocumentsTab.css";

type EmployeeDocumentsTabProps = {
  employeeId: number;
  token: string | null;
  role?: Role;
  currentEmployeeId?: number | null;
};

export default function EmployeeDocumentsTab({ employeeId, token, role, currentEmployeeId }: EmployeeDocumentsTabProps) {
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Custom document naming states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customName, setCustomName] = useState("");
  const [namingModalOpen, setNamingModalOpen] = useState(false);

  // Existing document renaming states
  const [renamingDoc, setRenamingDoc] = useState<EmployeeDocument | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const canUploadOrDelete = role === "ADMIN" || role === "HR" || currentEmployeeId === employeeId;

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await apiRequest<EmployeeDocument[]>(`/employees/${employeeId}/documents`, { token });
      if (response.success) {
        setDocuments(response.data);
      } else {
        setError(response.message);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch documents");
    } finally {
      setLoading(false);
    }
  }, [employeeId, token]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    // Suggest the file's original name (excluding the file extension for visual cleanliness, or full name)
    const extensionIndex = file.name.lastIndexOf(".");
    const suggestedName = extensionIndex !== -1 ? file.name.substring(0, extensionIndex) : file.name;
    setCustomName(suggestedName);
    setNamingModalOpen(true);
  };

  const confirmUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    try {
      setUploading(true);
      setError("");
      const formData = new FormData();
      formData.append("document", selectedFile);
      
      // Determine display name (append correct extension if omitted, or just pass input name)
      const nameInput = customName.trim();
      let finalName = selectedFile.name;
      if (nameInput) {
        const fileExt = selectedFile.name.substring(selectedFile.name.lastIndexOf("."));
        // Only append extension if not already typed by user
        finalName = nameInput.endsWith(fileExt) ? nameInput : `${nameInput}${fileExt}`;
      }
      formData.append("name", finalName);

      const response = await apiRequest<EmployeeDocument>(`/employees/${employeeId}/documents`, {
        method: "POST",
        token,
        body: formData,
      });

      if (response.success) {
        setDocuments([response.data, ...documents]);
        toast.success("Document uploaded successfully");
        setNamingModalOpen(false);
        setSelectedFile(null);
        setCustomName("");
      } else {
        setError(response.message);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const startRename = (doc: EmployeeDocument) => {
    setRenamingDoc(doc);
    // Strip extension for clean inline editing, if preferred, or keep as is
    const extIndex = doc.name.lastIndexOf(".");
    const editName = extIndex !== -1 ? doc.name.substring(0, extIndex) : doc.name;
    setRenameValue(editName);
  };

  const confirmRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingDoc || !renameValue.trim()) return;

    try {
      setRenaming(true);
      setError("");

      const extIndex = renamingDoc.name.lastIndexOf(".");
      const fileExt = extIndex !== -1 ? renamingDoc.name.substring(extIndex) : "";
      const nameInput = renameValue.trim();
      const finalName = nameInput.endsWith(fileExt) ? nameInput : `${nameInput}${fileExt}`;

      const response = await apiRequest<EmployeeDocument>(`/employees/${employeeId}/documents/${renamingDoc.id}`, {
        method: "PATCH",
        token,
        body: { name: finalName },
      });

      if (response.success) {
        setDocuments(documents.map(doc => doc.id === renamingDoc.id ? response.data : doc));
        toast.success("Document renamed successfully");
        setRenamingDoc(null);
        setRenameValue("");
      } else {
        setError(response.message);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to rename document");
    } finally {
      setRenaming(false);
    }
  };

  const handleDelete = async (documentId: number) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;

    try {
      setError("");
      const response = await apiRequest(`/employees/${employeeId}/documents/${documentId}`, {
        method: "DELETE",
        token,
      });

      if (response.success) {
        setDocuments(documents.filter(doc => doc.id !== documentId));
      } else {
        setError(response.message);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete document");
    }
  };

  const handleDownload = (documentId: number) => {
    // We can directly open the download endpoint in a new tab
    const url = `${API_BASE_URL}/employees/${employeeId}/documents/${documentId}/download`;
    // We need to attach the token though. Since standard links don't send Authorization headers,
    // we can either use a short-lived token in query params, or fetch the blob using fetch().
    
    // Using fetch to download blob
    fetch(url, {
      headers: { Authorization: `Bearer ${token ?? ""}` }
    })
    .then(res => {
      if (!res.ok) throw new Error("Failed to download");
      const filename = res.headers.get("content-disposition")?.split("filename=")[1]?.replace(/"/g, "") || "document";
      return res.blob().then(blob => ({ blob, filename }));
    })
    .then(({ blob, filename }) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    })
    .catch(err => {
      setError("Failed to download document");
      console.error(err);
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("pdf")) return <FileText size={24} />;
    if (mimeType.includes("image")) return <ImageIcon size={24} />;
    return <File size={24} />;
  };

  if (loading) {
    return <div className="documents-tab__loading">Loading documents...</div>;
  }

  return (
    <div className="documents-tab">
      <div className="documents-tab__header">
        <h2 className="documents-tab__title">Employee Documents</h2>
        {canUploadOrDelete && (
          <div className="documents-tab__actions">
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: "none" }} 
              onChange={handleFileSelect}
            />
            <button 
              className="btn btn--primary" 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={18} />
              {uploading ? "Uploading..." : "Upload Document"}
            </button>
          </div>
        )}
      </div>

      {error && <div className="documents-tab__error">{error}</div>}

      {documents.length === 0 ? (
        <div className="documents-tab__empty">
          <div className="documents-tab__empty-icon">
            <FolderOpen size={48} />
          </div>
          <p>No documents uploaded yet.</p>
          {canUploadOrDelete && <p className="documents-tab__empty-sub">Click 'Upload Document' to add files securely.</p>}
        </div>
      ) : (
        <div className="documents-grid">
          {documents.map(doc => (
            <div key={doc.id} className="document-card">
              <div className="document-card__icon">
                {getFileIcon(doc.mimeType)}
              </div>
              <div className="document-card__content">
                <h3 className="document-card__name" title={doc.name}>{doc.name}</h3>
                <div className="document-card__meta">
                  <span>{formatDate(doc.createdAt)}</span>
                  <span>&bull;</span>
                  <span>{formatBytes(doc.size)}</span>
                </div>
              </div>
              <div className="document-card__actions">
                <button 
                  className="document-btn document-btn--download" 
                  onClick={() => handleDownload(doc.id)}
                  title="Download"
                >
                  <Download size={16} />
                </button>
                {canUploadOrDelete && (
                  <>
                    <button 
                      className="document-btn document-btn--rename" 
                      onClick={() => startRename(doc)}
                      title="Rename"
                    >
                      <Pencil size={16} />
                    </button>
                    <button 
                      className="document-btn document-btn--delete" 
                      onClick={() => handleDelete(doc.id)}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Document Naming Modal */}
      <Modal open={namingModalOpen} title="Name Your Document" onClose={() => {
        setNamingModalOpen(false);
        setSelectedFile(null);
      }}>
        <form onSubmit={confirmUpload} className="modal-form-content">
          <div className="form-group">
            <label htmlFor="custom-doc-name">Document Display Name (Optional)</label>
            <input
              id="custom-doc-name"
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="form-control"
              placeholder="Enter custom document name"
              autoFocus
            />
          </div>
          <div className="modal-actions">
            <button 
              type="button"
              className="btn btn--secondary" 
              onClick={() => {
                setNamingModalOpen(false);
                setSelectedFile(null);
              }}
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="btn btn--primary" 
              disabled={uploading}
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Rename Document Modal */}
      <Modal open={!!renamingDoc} title="Rename Document" onClose={() => setRenamingDoc(null)}>
        <form onSubmit={confirmRename} className="modal-form-content">
          <div className="form-group">
            <label htmlFor="rename-doc-name">New Display Name</label>
            <input
              id="rename-doc-name"
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="form-control"
              placeholder="Enter document name"
              autoFocus
              required
            />
          </div>
          <div className="modal-actions">
            <button 
              type="button"
              className="btn btn--secondary" 
              onClick={() => setRenamingDoc(null)}
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="btn btn--primary" 
              disabled={renaming}
            >
              {renaming ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
