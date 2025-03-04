import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';

interface ImageUploadProps {
  image: string | null;
  onImageUpload: (url: string) => void;
  onImageRemove: () => void;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  image,
  onImageUpload,
  onImageRemove
}) => {
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    try {
      const file = acceptedFiles[0];
      if (!file) return;

      // Проверяем размер файла (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Размер файла не должен превышать 5MB');
        return;
      }

      const timestamp = Date.now();
      const fileName = `${timestamp}-${file.name}`;
      const storageRef = ref(storage, `product-images/${fileName}`);

      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      onImageUpload(downloadURL);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Ошибка при загрузке изображения');
    }
  }, [onImageUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024 // 5MB
  });

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">
        Изображение товара
      </label>

      {image ? (
        <div className="relative inline-block">
          <img
            src={image}
            alt="Product"
            className="w-32 h-32 object-cover rounded-lg"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onImageRemove();
            }}
            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-emerald-500 bg-emerald-50'
              : 'border-gray-300 hover:border-emerald-500'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-600">
            {isDragActive
              ? 'Перетащите файл сюда'
              : 'Перетащите изображение или нажмите для выбора'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            PNG, JPG или WEBP до 5MB
          </p>
        </div>
      )}
    </div>
  );
};