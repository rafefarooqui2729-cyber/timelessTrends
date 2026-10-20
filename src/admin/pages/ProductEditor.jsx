import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Watch, Save, ArrowLeft, Plus, Trash2, Upload,
  Image as ImageIcon, Check, AlertCircle, Copy, CheckCircle
} from 'lucide-react';
import { api } from '../api';
import { useAdminAuth } from '../AdminAuthContext';

export function ProductEditor() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { isInventoryManager, isSuperAdmin, isMarketingManager } = useAdminAuth();
  const canManageOffers = isSuperAdmin || isMarketingManager;

  const [categories, setCategories] = useState([]);
  const [offers, setOffers] = useState([]);
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('TIMELESS TRENDS');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('draft');
  const [isNewArrival, setIsNewArrival] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [displayPriority, setDisplayPriority] = useState(0);

  // Specifications array: [{ label: string, value: string }]
  const [specs, setSpecs] = useState([
    { label: 'Case Diameter', value: '' },
    { label: 'Case Material', value: '' },
    { label: 'Movement', value: '' },
    { label: 'Water Resistance', value: '' }
  ]);

  // Variants array
  const [variants, setVariants] = useState([
    { colour: 'Default', price_override: '', min_stock: 2, stock_on_hand: 5, avg_cost: '' }
  ]);

  // Image Upload state
  const [images, setImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    loadCategories();
    if (canManageOffers) loadOffers();
    if (!isNew) {
      loadProduct();
    }
  }, [id]);

  async function loadOffers() {
  try {
    const data = await api('/api/admin/offers');

    const today = new Date().toLocaleDateString('en-CA');

    const availableOffers = data.filter((offer) => {
      return (
        Number(offer.is_active) === 1 &&
        (!offer.start_date || offer.start_date <= today) &&
        (!offer.end_date || offer.end_date >= today)
      );
    });

    setOffers(availableOffers);
  } catch (err) {
    console.error('Failed to load offers:', err.message);
  }
}

  async function loadCategories() {
    try {
      const data = await api('/api/admin/categories');
      setCategories(data);
      if (isNew && data.length > 0) setCategory(data[0].slug);
    } catch {}
  }

  async function loadProduct() {
    try {
      setLoading(true);
      const p = await api(`/api/admin/products/${id}`);
      setName(p.name);
      setBrand(p.brand || '');
      setModel(p.model || '');
      setCategory(p.category || '');
      setSellingPrice(p.selling_price != null ? String(p.selling_price) : '');
      setOriginalPrice(p.original_price != null ? String(p.original_price) : '');
      setSelectedOfferId(p.offer_id != null ? String(p.offer_id) : '');
      setDescription(p.description || '');
      setStatus(p.status || 'draft');
      setIsNewArrival(Boolean(p.is_new_arrival));
      setIsFeatured(Boolean(p.is_featured));
      setDisplayPriority(p.display_priority || 0);
      setSpecs(p.specs && p.specs.length > 0 ? p.specs : [{ label: 'Case Diameter', value: '' }]);
      setVariants(p.variants || []);
      setImages(p.images || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Specifications helpers
  const handleAddSpec = () => {
    setSpecs([...specs, { label: '', value: '' }]);
  };

  const handleUpdateSpec = (index, field, val) => {
    const updated = [...specs];
    updated[index][field] = val;
    setSpecs(updated);
  };

  const handleRemoveSpec = (index) => {
    setSpecs(specs.filter((_, i) => i !== index));
  };

  // Variants helpers
  const handleAddVariant = () => {
    setVariants([...variants, { colour: '', price_override: '', min_stock: 2, stock_on_hand: 0, avg_cost: '' }]);
  };

  const handleUpdateVariant = (index, field, val) => {
    const updated = [...variants];
    updated[index][field] = val;
    setVariants(updated);
  };

  const handleRemoveVariant = async (index, variantId) => {
    if (!isNew && variantId) {
      if (!window.confirm('Delete this variant colour?')) return;
      try {
        await api(`/api/admin/variants/${variantId}`, { method: 'DELETE' });
        setVariants(variants.filter(v => v.id !== variantId));
        return;
      } catch (err) {
        alert(err.message);
        return;
      }
    }
    setVariants(variants.filter((_, i) => i !== index));
  };

  // Image Upload handler
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isNew) {
      alert('Please save the product basic details first before uploading gallery photographs.');
      return;
    }

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('image', file);
      formData.append('alt', `${name} watch photograph`);

      const updated = await api(`/api/admin/products/${id}/images`, {
        method: 'POST',
        body: formData,
        isFormData: true
      });
      setImages(updated.images || []);
      setSuccess('Image uploaded and optimized to WebP successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!window.confirm('Delete this gallery photograph?')) return;
    try {
      const updated = await api(`/api/admin/images/${imageId}`, { method: 'DELETE' });
      setImages(updated.images || []);
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Product name is required.');
      return;
    }

    setSaving(true);
    setError(null);

    const validSpecs = specs.filter(s => s.label.trim() && s.value.trim());

    const payload = {
  name: name.trim(),
  brand: brand.trim() || null,
  model: model.trim() || null,
  category: category || null,
  selling_price: sellingPrice ? Number(sellingPrice) : null,
  original_price: originalPrice ? Number(originalPrice) : null,
  ...(canManageOffers
    ? { offer_id: selectedOfferId ? Number(selectedOfferId) : null }
    : {}),
      description: description.trim() || null,
      specs: validSpecs,
      status,
      is_new_arrival: isNewArrival,
      is_featured: isFeatured,
      display_priority: Number(displayPriority) || 0
    };

    try {
      if (isNew) {
        // Must provide at least one variant when creating
        const validVariants = variants.map(v => ({
          colour: v.colour.trim() || 'Default Finish',
          price_override: v.price_override ? Number(v.price_override) : null,
          min_stock: Number(v.min_stock) || 2,
          stock_on_hand: Number(v.stock_on_hand) || 0,
          avg_cost: v.avg_cost ? Number(v.avg_cost) : null
        }));

        const created = await api('/api/admin/products', {
          method: 'POST',
          body: { ...payload, variants: validVariants }
        });
        navigate(`/admin/products/${created.id}/edit`);
      } else {
        await api(`/api/admin/products/${id}`, {
          method: 'PUT',
          body: payload
        });
        setSuccess('Watch details updated successfully!');
        setTimeout(() => setSuccess(null), 3000);
        loadProduct();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div style={{ color: '#888', padding: '36px 0' }}>Loading timepiece editor...</div>;
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/admin/products" className="btn-admin-ghost" style={{ padding: '8px' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', color: '#fff' }}>
              {isNew ? 'Add New Timepiece' : `Edit: ${name}`}
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>
              {isNew ? 'Create a new catalog watch' : `ID: TT-P${String(id).padStart(4, '0')}`}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="btn-admin-gold"
          style={{ padding: '10px 24px' }}
        >
          <Save size={16} />
          <span>{saving ? 'Saving Changes...' : 'Save Watch'}</span>
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(220, 38, 38, 0.15)', border: '1px solid #7F1D1D', color: '#FCA5A5', padding: '14px', borderRadius: '4px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ backgroundColor: 'rgba(22, 138, 74, 0.15)', border: '1px solid #168A4A', color: '#86EFAC', padding: '14px', borderRadius: '4px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Section 1: Basic Information */}
        <div className="admin-card" style={{ padding: '24px', marginBottom: '24px' }}>
          <h3 className="admin-card-title" style={{ marginBottom: '20px', borderBottom: '1px solid #282828', paddingBottom: '12px' }}>
            Basic Information
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
            <div className="admin-form-group">
              <label className="admin-form-label">Watch Model Name *</label>
              <input
                type="text"
                required
                className="admin-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Master Chronograph Sunburst"
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Brand</label>
              <input
                type="text"
                className="admin-input"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="TIMELESS TRENDS"
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Model Reference</label>
              <input
                type="text"
                className="admin-input"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. TT-MC42"
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Category</label>
              <select
                className="admin-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">None / Unassigned</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.slug}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Catalog Status</label>
              <select
                className="admin-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="draft">Draft (Hidden from public store)</option>
                <option value="published">Published (Visible in store)</option>
                <option value="archived">Archived (Removed from catalog)</option>
              </select>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Display Priority (Ordering)</label>
              <input
                type="number"
                className="admin-input"
                value={displayPriority}
                onChange={(e) => setDisplayPriority(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '24px', marginTop: '16px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={isNewArrival}
                onChange={(e) => setIsNewArrival(e.target.checked)}
              />
              <span>Mark as New Arrival</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
              />
              <span>Feature on Homepage</span>
            </label>
          </div>
        </div>

        {/* Section 2: Pricing */}
        <div className="admin-card" style={{ padding: '24px', marginBottom: '24px' }}>
          <h3 className="admin-card-title" style={{ marginBottom: '20px', borderBottom: '1px solid #282828', paddingBottom: '12px' }}>
            Pricing &amp; Valuation (INR ₹)
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            <div className="admin-form-group">
              <label className="admin-form-label">Selling Price (₹)</label>
              <input
                type="number"
                min="0"
                className="admin-input"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="Leave blank for 'Price on request'"
              />
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Original Retail Price (₹)</label>
              <input
                type="number"
                min="0"
                className="admin-input"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                placeholder="Used for strike-through discount"
              />
            </div>
          </div>
        </div>

        {/* Optional Manual Offer */}
{canManageOffers && (
  <div className="admin-card" style={{ padding: '24px', marginBottom: '24px' }}>
    <h3 className="admin-card-title" style={{ marginBottom: '12px' }}>
      Apply Offer (Optional)
    </h3>

    <p style={{ fontSize: '0.8rem', color: '#999', marginBottom: '16px' }}>
      No discount is applied unless you select an offer.
      Expired or disabled offers automatically stop applying.
    </p>

    <div className="admin-form-group">
      <label className="admin-form-label">Select Offer</label>

      <select
        className="admin-select"
        value={selectedOfferId}
        onChange={(e) => setSelectedOfferId(e.target.value)}
      >
        <option value="">No Offer — Use Normal Selling Price</option>

        {offers.map((offer) => (
          <option key={offer.id} value={String(offer.id)}>
            {offer.title} — {offer.discount_type === 'percentage'
              ? `${offer.discount_value}% OFF`
              : `₹${offer.discount_value} OFF`}
          </option>
        ))}
      </select>
    </div>
  </div>
)}

        {/* Section 3: Editorial Description */}
        <div className="admin-card" style={{ padding: '24px', marginBottom: '24px' }}>
          <h3 className="admin-card-title" style={{ marginBottom: '20px', borderBottom: '1px solid #282828', paddingBottom: '12px' }}>
            Editorial Presentation Narrative
          </h3>

          <div className="admin-form-group">
            <textarea
              rows={4}
              className="admin-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Editorial description detailing watch movement, craftsmanship, dial textures, and styling versatility..."
            />
          </div>
        </div>

        {/* Section 4: Specifications */}
        <div className="admin-card" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="admin-card-title">Confirmed Specifications</h3>
            <button type="button" onClick={handleAddSpec} className="btn-admin-ghost" style={{ fontSize: '0.75rem' }}>
              <Plus size={13} />
              <span>Add Specification</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {specs.map((s, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  className="admin-input"
                  placeholder="Label (e.g. Case Diameter)"
                  value={s.label}
                  onChange={(e) => handleUpdateSpec(idx, 'label', e.target.value)}
                />
                <input
                  type="text"
                  className="admin-input"
                  placeholder="Specification Value (e.g. 42 mm)"
                  value={s.value}
                  onChange={(e) => handleUpdateSpec(idx, 'value', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveSpec(idx)}
                  className="btn-admin-ghost"
                  style={{ color: '#F87171', padding: '8px' }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Section 5: Colour Variants & Stock */}
        <div className="admin-card" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 className="admin-card-title">Colour &amp; Finish Variants</h3>
              <p style={{ fontSize: '0.78rem', color: '#888' }}>
                Each colour tracks physical stock on hand and minimum reorder threshold.
              </p>
            </div>
            <button type="button" onClick={handleAddVariant} className="btn-admin-ghost" style={{ fontSize: '0.75rem' }}>
              <Plus size={13} />
              <span>Add Colour Variant</span>
            </button>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Colour Name *</th>
                  <th>Price Override (₹)</th>
                  <th>Min Stock Alert</th>
                  {isNew && <th>Initial Units</th>}
                  {!isNew && <th>Stock on Hand</th>}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        type="text"
                        required
                        className="admin-input"
                        placeholder="e.g. Obsidian Black Steel"
                        value={v.colour}
                        onChange={(e) => handleUpdateVariant(idx, 'colour', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="admin-input"
                        placeholder="Inherits price"
                        value={v.price_override || ''}
                        onChange={(e) => handleUpdateVariant(idx, 'price_override', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="admin-input"
                        style={{ width: '80px' }}
                        value={v.min_stock || 2}
                        onChange={(e) => handleUpdateVariant(idx, 'min_stock', e.target.value)}
                      />
                    </td>
                    <td>
                      {isNew ? (
                        <input
                          type="number"
                          className="admin-input"
                          style={{ width: '90px' }}
                          value={v.stock_on_hand || 0}
                          onChange={(e) => handleUpdateVariant(idx, 'stock_on_hand', e.target.value)}
                        />
                      ) : (
                        <span style={{ fontWeight: 700, color: '#4ADE80' }}>
                          {v.stock_on_hand} units
                        </span>
                      )}
                    </td>
                    <td>
                      {variants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveVariant(idx, v.id)}
                          className="btn-admin-ghost"
                          style={{ color: '#F87171', padding: '6px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 6: Image Gallery */}
        {!isNew && (
          <div className="admin-card" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 className="admin-card-title">Product Photographs Gallery</h3>
                <p style={{ fontSize: '0.78rem', color: '#888' }}>
                  Upload multiple photos. Originals are stored privately; high-res WebP derivatives are served on store.
                </p>
              </div>

              <label className="btn-admin-gold" style={{ cursor: 'pointer' }}>
                <Upload size={14} />
                <span>{uploadingImage ? 'Uploading & Converting...' : 'Upload Photo'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                  disabled={uploadingImage}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
              {images.map((img) => (
                <div
                  key={img.id}
                  style={{
                    backgroundColor: '#111',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    position: 'relative',
                    aspectRatio: '4 / 5'
                  }}
                >
                  <img
                    src={img.url}
                    alt={img.alt || 'Watch photo'}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleDeleteImage(img.id)}
                    style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      background: 'rgba(0, 0, 0, 0.7)',
                      border: 'none',
                      color: '#F87171',
                      borderRadius: '50%',
                      padding: '4px',
                      cursor: 'pointer'
                    }}
                    title="Delete image"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              {images.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '32px', border: '1px dashed #333', borderRadius: '4px', color: '#777' }}>
                  <ImageIcon size={32} style={{ marginBottom: '8px', color: '#555' }} />
                  <div>No photographs uploaded yet for this watch.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginBottom: '40px' }}>
          <Link to="/admin/products" className="btn-admin-ghost">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="btn-admin-gold"
            style={{ padding: '12px 32px' }}
          >
            <Save size={16} />
            <span>{saving ? 'Saving...' : 'Save Watch'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default ProductEditor;
