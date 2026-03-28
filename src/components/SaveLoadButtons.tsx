import React, { useRef } from 'react';
import { useApp } from '../contexts/AppContext';

export default function SaveLoadButtons() {
  const { saveToFile, loadFromFile } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadFromFile(file);
      e.target.value = '';
    }
  };

  return (
    <div className="flex gap-2 p-4">
      <button
        onClick={saveToFile}
        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3 rounded transition"
      >
        💾 Save
      </button>
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-sm py-2 px-3 rounded transition"
      >
        📂 Load
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
