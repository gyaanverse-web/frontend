"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";

type UploadSignature = {
  uploadUrl: string;
  fields: {
    api_key: string;
    timestamp: number;
    signature: string;
    folder: string;
    public_id: string;
    resource_type: "image" | "raw" | "auto";
  };
  maxBytes: number;
  allowedContentTypes: string[];
};

type CloudinaryUploadResponse = {
  secure_url: string;
  public_id: string;
};

type Props = {
  /**
   * How the caller wants to request a signature. Returns the parsed signature
   * payload from the backend (`/storage/answer-upload-signature` or
   * `/tenant/storage/upload-signature`).
   */
  getSignature: (contentType: string) => Promise<UploadSignature>;
  /** Current image URL if one is already uploaded — shows as preview. */
  value: string | null;
  /** Fired after a successful upload. */
  onChange: (url: string, publicId: string) => void;
  /** Optional: shown above the file input. */
  label?: string;
  /** Optional: disable while a parent flow is in flight. */
  disabled?: boolean;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function ImageUpload({ getSignature, value, onChange, label, disabled }: Props) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [error, setError]         = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(""); setProgress(0); setUploading(true);

    try {
      // 1. Ask backend for a signed upload payload
      const sig = await getSignature(file.type);

      if (!sig.allowedContentTypes.includes(file.type)) {
        throw new Error(`Unsupported file type. Allowed: ${sig.allowedContentTypes.join(", ")}`);
      }
      if (file.size > sig.maxBytes) {
        throw new Error(`File is ${formatBytes(file.size)}, max allowed is ${formatBytes(sig.maxBytes)}`);
      }

      // 2. Build multipart body Cloudinary expects
      const form = new FormData();
      form.append("api_key", sig.fields.api_key);
      form.append("timestamp", String(sig.fields.timestamp));
      form.append("signature", sig.fields.signature);
      form.append("folder", sig.fields.folder);
      form.append("public_id", sig.fields.public_id);
      form.append("file", file);

      // 3. XHR (not fetch) so we get an upload progress event
      const result = await new Promise<CloudinaryUploadResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", sig.uploadUrl);

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            setProgress(Math.round((evt.loaded / evt.total) * 100));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data);
            } else {
              reject(new Error(data?.error?.message ?? `Upload failed (${xhr.status})`));
            }
          } catch {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        };

        xhr.send(form);
      });

      onChange(result.secure_url, result.public_id);
      // Reset the input so selecting the same file again still fires onChange
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <div>
      {label && <span className="gv-label">{label}</span>}

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {value && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Uploaded answer"
            style={{
              maxWidth: 180,
              maxHeight: 180,
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-md)",
              objectFit: "contain",
              background: "var(--surface-inset)",
            }}
          />
        )}

        <div style={{ flex: 1 }}>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={handleFile}
            disabled={uploading || disabled}
            style={{ display: "none" }}
          />

          {!uploading && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button
                type="button"
                variant="app"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={disabled}
              >
                {value ? "Replace image" : "Upload image"}
              </Button>
              {value && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => onChange("", "")}
                  disabled={disabled}
                >
                  Remove
                </Button>
              )}
            </div>
          )}

          {uploading && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                Uploading… {progress}%
              </div>
              <div
                style={{
                  width: "100%",
                  maxWidth: 240,
                  height: 6,
                  background: "var(--surface-inset)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-pill)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${progress}%`,
                    height: "100%",
                    background: "var(--accent)",
                    transition: "width 100ms linear",
                  }}
                />
              </div>
            </div>
          )}

          {error && (
            <p style={{ margin: "8px 0 0", color: "var(--danger)", fontSize: 12 }}>{error}</p>
          )}

          <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--text-muted)" }}>
            JPG, PNG, WebP, or HEIC. Up to 10 MB. Clear photo of your handwritten answer works best.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Helper signature-fetchers ─────────────────────────────────────────────

/** For students uploading an answer image for a specific session+question. */
export function makeAnswerUploadSigner(sessionId: string, questionId: string) {
  return (contentType: string) =>
    api.post<UploadSignature>("/storage/answer-upload-signature", {
      sessionId,
      questionId,
      contentType,
    });
}

/** For teachers uploading question/syllabus/avatar assets. */
export function makeTenantUploadSigner(
  scope: "question" | "syllabus" | "avatar",
  contextKey: string,
) {
  return (contentType: string) =>
    api.post<UploadSignature>("/tenant/storage/upload-signature", {
      scope,
      contextKey,
      contentType,
    });
}
