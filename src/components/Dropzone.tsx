import { useCallback, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';

interface Props {
  onFiles: (files: File[]) => void;
  disabled: boolean;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export function Dropzone({ onFiles, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const files = Array.from(list).filter(
        (f) => ACCEPTED.includes(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)
      );
      if (files.length) onFiles(files);
    },
    [onFiles]
  );

  return (
    <div
      className={`dropzone ${dragOver ? 'dropzone--over' : ''} ${disabled ? 'dropzone--disabled' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <UploadCloud size={32} />
      <p>
        <strong>Drop images here</strong> or click to browse
      </p>
      <span className="hint">JPG, PNG, WEBP — select hundreds at once, they queue automatically</span>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
