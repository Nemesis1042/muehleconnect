import { useEffect, useState } from 'react'
import type { Product, ProductInput, TaxClass } from '@shared/types'

const emptyForm: ProductInput = {
  name: '',
  priceCents: 0,
  category: 'Essen',
  taxClass: 'A',
  depositCents: 0,
  sortOrder: 0,
  active: true
}

function eurosToCents(value: string): number {
  const normalized = value.replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0
}

function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2)
}

export default function Produkte(): JSX.Element {
  const [products, setProducts] = useState<Product[]>([])
  const [form, setForm] = useState<ProductInput>(emptyForm)

  useEffect(() => {
    void reload()
  }, [])

  async function reload(): Promise<void> {
    setProducts(await window.kassen.products.list())
  }

  async function handleCreate(): Promise<void> {
    if (!form.name.trim()) return
    await window.kassen.products.create({ ...form, sortOrder: products.length })
    setForm(emptyForm)
    await reload()
  }

  async function handleUpdate(id: number, patch: Partial<ProductInput>): Promise<void> {
    await window.kassen.products.update(id, patch)
    await reload()
  }

  async function handleDelete(id: number): Promise<void> {
    await window.kassen.products.remove(id)
    await reload()
  }

  async function handleMove(index: number, direction: -1 | 1): Promise<void> {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= products.length) return
    const reordered = [...products]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)
    await window.kassen.products.reorder(reordered.map((p) => p.id))
    await reload()
  }

  return (
    <div className="produkte-page">
      <div className="produkte-toolbar">
        <h1>Produkte</h1>
      </div>

      <div className="produkt-form">
        <label>
          Name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label>
          Preis (€)
          <input
            value={centsToEuros(form.priceCents)}
            onChange={(e) => setForm({ ...form, priceCents: eurosToCents(e.target.value) })}
          />
        </label>
        <label>
          Kategorie
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </label>
        <label>
          MwSt.
          <select
            value={form.taxClass}
            onChange={(e) => setForm({ ...form, taxClass: e.target.value as TaxClass })}
          >
            <option value="A">A</option>
            <option value="B">B</option>
          </select>
        </label>
        <label>
          Pfand (€)
          <input
            value={centsToEuros(form.depositCents)}
            onChange={(e) => setForm({ ...form, depositCents: eurosToCents(e.target.value) })}
          />
        </label>
        <button className="button-primary" onClick={() => void handleCreate()}>
          Hinzufügen
        </button>
      </div>

      <table className="produkte-table">
        <colgroup>
          <col style={{ width: '9%' }} />
          <col style={{ width: '26%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '15%' }} />
        </colgroup>
        <thead>
          <tr>
            <th></th>
            <th>Name</th>
            <th>Preis</th>
            <th>Kategorie</th>
            <th>MwSt.</th>
            <th>Pfand</th>
            <th>Aktiv</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, index) => (
            <tr key={p.id}>
              <td>
                <div className="produkte-actions">
                  <button
                    className="button-secondary"
                    onClick={() => void handleMove(index, -1)}
                    disabled={index === 0}
                  >
                    ↑
                  </button>
                  <button
                    className="button-secondary"
                    onClick={() => void handleMove(index, 1)}
                    disabled={index === products.length - 1}
                  >
                    ↓
                  </button>
                </div>
              </td>
              <td>
                <input
                  defaultValue={p.name}
                  onBlur={(e) => {
                    if (e.target.value !== p.name) void handleUpdate(p.id, { name: e.target.value })
                  }}
                />
              </td>
              <td>
                <input
                  defaultValue={centsToEuros(p.priceCents)}
                  onBlur={(e) => void handleUpdate(p.id, { priceCents: eurosToCents(e.target.value) })}
                />
              </td>
              <td>
                <input
                  defaultValue={p.category}
                  onBlur={(e) => {
                    if (e.target.value !== p.category)
                      void handleUpdate(p.id, { category: e.target.value })
                  }}
                />
              </td>
              <td>
                <select
                  defaultValue={p.taxClass}
                  onChange={(e) => void handleUpdate(p.id, { taxClass: e.target.value as TaxClass })}
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                </select>
              </td>
              <td>
                <input
                  defaultValue={centsToEuros(p.depositCents)}
                  onBlur={(e) => void handleUpdate(p.id, { depositCents: eurosToCents(e.target.value) })}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={p.active}
                  onChange={(e) => void handleUpdate(p.id, { active: e.target.checked })}
                />
              </td>
              <td>
                <button className="button-secondary" onClick={() => void handleDelete(p.id)}>
                  Löschen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
