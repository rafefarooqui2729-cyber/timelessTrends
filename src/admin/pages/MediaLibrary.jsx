import React, { useState, useEffect } from 'react';
import {
  Image as ImageIcon, Upload, Trash2, Copy, Check, Search, Filter,
  RefreshCw, AlertTriangle, CheckCircle, ExternalLink, X
} from 'lucide-react';
import { api } from '../api';
import { useAdminAuth } from '../AdminAuthContext';

export function MediaLibrary() {
  const { isSuperAdmin, isInventoryManager } = useAdminAuth();
  const [images, setImages] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [copiedId, setCopiedId] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Upload modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadProductId, setUploadProductId] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadIsPrimary, setUploadIsPrimary] = useState(false);
  const [uploading, setUploading] = useState(false);

  const canEdit = isSuperAdmin || isInventoryManager;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mediaData, prodsData] = await Promise.all([
        api('/api/admin/media'),
        api('/api/admin/products').catch(() => [])
      ]);
      setImages(mediaData || []);
      setProducts(prodsData || []);
    } catch (err) {
      setError(err.message || 'Failed to load media assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const copyUrl = (img) => {
    const fullUrl = window.location.origin + img.url;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(img.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (img) => {
    if (!window.confirm('Are you sure you want to permanently delete this WebP media asset?')) return;
    try {
      await api(`/api/admin/images/${img.id}`, { method: 'DELETE' });
      setSuccessMsg('Image asset removed.');
      setImages((prev) => prev.filter((i) => i.id !== img.id));
    } catch (err) {
      alert(err.message || 'Failed to delete image');
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadProductId) {
      alert('Please select a target watch product');
      return;
    }
    if (!uploadFile) {
      alert('Please choose an image file (PNG/JPEG/WebP)');
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', uploadFile);
      if (uploadIsPrimary) fd.append('is_primary', 'true');

      await api(`/api/admin/products/${uploadProductId}/images`, {
        method: 'POST',
        body: fd,
        isFormData: true
      });

      setSuccessMsg('New optimized WebP image processed and uploaded successfully.');
      setUploadModalOpen(false);
      setUploadFile(null);
      setUploadProductId('');
      await loadData();
    } catch (err) {
      alert(err.message || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const filteredImages = images.filter((img) => {
    const matchesSearch =
      (img.product_name && img.product_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (img.original_filename && img.original_filename.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (img.variant_colour && img.variant_colour.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (selectedProduct !== 'all') {
      return img.product_id === parseInt(selectedProduct, 10);
    }

    return true;
  });

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Media & Visual Assets Library</h1>
          <p className="admin-page-subtitle">Inspect Sharp-optimized WebP horology photos and product gallery references</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={loadData} className="btn btn-secondary" disabled={loading} style={{ fontSize: '0.85rem' }}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          {canEdit && (
            <button onClick={() => setUploadModalOpen(true)} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
              <Upload size={15} /> Upload Media
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="admin-alert admin-alert-danger" style={{ marginBottom: '20px' }}>
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {successMsg && (
        <div className="admin-alert admin-alert-success" style={{ marginBottom: '20px' }}>
          <CheckCircle size={18} /> {successMsg}
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', marginLeft: 'auto', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Filter bar */}
      <div className="admin-card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-muted)' }} />
            <input
              type="text"
              placeholder="Search by watch name, filename, or colour..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="admin-input"
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="admin-select"
            style={{ width: 'auto', minWidth: '220px' }}
          >
            <option value="all">All Watches ({images.length} images)</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.brand})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Media Grid */}
      {filteredImages.length === 0 ? (
        <div className="admin-card" style={{ textAlign: 'center', padding: '60px', color: 'var(--admin-text-muted)' }}>
          <ImageIcon size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p>No media assets found matching current criteria.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
          {filteredImages.map((img) => (
            <div
              key={img.id}
              className="admin-card"
              style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <div style={{ position: 'relative', height: '200px', backgroundColor: '#000', borderRadius: '4px', overflow: 'hidden' }}>
                <img
                  src={img.url}
                  alt={img.original_filename || 'Watch asset'}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  loading="lazy"
                />
                {img.is_primary ? (
                  <span
                    className="admin-badge badge-role-super"
                    style={{ position: 'absolute', top: '8px', left: '8px', fontSize: '0.68rem', padding: '2px 8px' }}
                  >
                    Primary Photo
                  </span>
                ) : null}
              </div>

              <div>
                <div style={{ fontWeight: 600, color: '#fff', fontSize: '0.88rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {img.product_name || 'Unassigned Watch'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--admin-gold)' }}>
                  {img.variant_colour ? `Variant: ${img.variant_colour}` : (img.product_code || 'Media Item')}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--admin-text-muted)', marginTop: '2px' }}>
                  WebP derivative • {new Date(img.created_at).toLocaleDateString()}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '6px', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--admin-card-border)' }}>
                <button
                  onClick={() => copyUrl(img)}
                  className="btn btn-sm btn-outline"
                  style={{ flex: 1, fontSize: '0.75rem' }}
                  title="Copy full URL"
                >
                  {copiedId === img.id ? <Check size={13} color="var(--admin-success)" /> : <Copy size={13} />}
                  {copiedId === img.id ? 'Copied' : 'Copy URL'}
                </button>
                <a
                  href={img.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-sm btn-outline"
                  title="Open full size in new tab"
                >
                  <ExternalLink size={13} />
                </a>
                {canEdit && (
                  <button
                    onClick={() => handleDelete(img)}
                    className="btn btn-sm btn-outline"
                    style={{ color: 'var(--admin-danger)' }}
                    title="Delete image"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Upload New Watch Photo</h3>
              <button onClick={() => setUploadModalOpen(false)} className="admin-modal-close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUploadSubmit}>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label className="admin-label">Assign to Watch *</label>
                  <select
                    required
                    value={uploadProductId}
                    onChange={(e) => setUploadProductId(e.target.value)}
                    className="admin-select"
                  >
                    <option value="">Select watch...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.brand})</option>
                    ))}
                  </select>
                </div>

                <div className="admin-form-group">
                  <label className="admin-label">Watch Photo File *</label>
                  <input
                    type="file"
                    required
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setUploadFile(e.target.files[0] || null)}
                    className="admin-input"
                    style={{ padding: '8px' }}
                  />
                  <span className="admin-help-text">
                    File will be automatically optimized via Sharp into WebP format and stored securely.
                  </span>
                </div>

                <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="isPrimaryCheck"
                    checked={uploadIsPrimary}
                    onChange={(e) => setUploadIsPrimary(e.target.checked)}
                    style={{ accentColor: 'var(--admin-gold)' }}
                  />
                  <label htmlFor="isPrimaryCheck" style={{ fontSize: '0.85rem', color: '#fff', cursor: 'pointer' }}>
                    Set as Primary Showcase Photo for this watch
                  </label>
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="btn btn-primary"
                >
                  {uploading ? 'Optimizing & Uploading...' : 'Upload & Process'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MediaLibrary;
