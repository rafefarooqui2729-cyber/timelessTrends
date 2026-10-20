const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'product-images';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase Storage configuration is missing');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function uploadImage(filePath, buffer) {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, buffer, {
      contentType: 'image/webp',
      upsert: false
    });

  if (error) {
    throw new Error(`Supabase image upload failed: ${error.message}`);
  }

  return filePath;
}

async function deleteImage(filePath) {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([filePath]);

  if (error) {
    throw new Error(`Supabase image deletion failed: ${error.message}`);
  }
}

function getPublicImageUrl(filePath) {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

module.exports = {
  uploadImage,
  deleteImage,
  getPublicImageUrl
};