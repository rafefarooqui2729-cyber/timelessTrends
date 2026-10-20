const files = new Map();

async function uploadImage(filePath, buffer) {
  if (files.has(filePath)) {
    throw new Error('File already exists');
  }

  files.set(filePath, Buffer.from(buffer));
  return filePath;
}

async function deleteImage(filePath) {
  files.delete(filePath);
}

function getPublicImageUrl(filePath) {
  return `http://mock-storage.local/${filePath}`;
}

function getImage(filePath) {
  return files.get(filePath);
}

function reset() {
  files.clear();
}

module.exports = {
  uploadImage,
  deleteImage,
  getPublicImageUrl,
  getImage,
  reset
};