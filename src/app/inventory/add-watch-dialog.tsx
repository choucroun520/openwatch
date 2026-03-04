"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { CurrencyInput } from "@/components/shared/currency-input"
import { createClient } from "@/lib/supabase/client"
import {
  MATERIALS,
  CONDITIONS,
  DIAL_COLORS,
  MOVEMENTS,
  COMPLICATIONS,
  CASE_SIZES,
} from "@/lib/constants"
import type { Brand, Model } from "@/lib/types"
import { cn } from "@/lib/utils"

interface AddWatchDialogProps {
  brands: Brand[]
  userId: string
  onSuccess: () => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

const initialFormData = {
  brand_id: "",
  model_id: "",
  reference_number: "",
  year: "",
  serial_number: "",
  material: "",
  dial_color: "",
  case_size: "",
  movement: "",
  complications: [] as string[],
  condition: "",
  condition_score: "",
  has_box: false,
  has_papers: false,
  has_warranty: false,
  warranty_date: "",
  service_history: "",
  wholesale_price: "",
  retail_price: "",
  accepts_inquiries: true,
  notes: "",
}

type FormData = typeof initialFormData

const STEP_LABELS = [
  "Identity",
  "Details",
  "Completeness",
  "Pricing",
  "Review",
]

function StepIndicator({
  currentStep,
  total,
}: {
  currentStep: number
  total: number
}) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => {
        const step = i + 1
        const isComplete = step < currentStep
        const isCurrent = step === currentStep
        return (
          <div key={step} className="flex items-center">
            <div
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                isComplete
                  ? "bg-blue-600 text-white"
                  : isCurrent
                    ? "bg-gradient-to-br from-blue-600 to-purple-600 text-white ring-2 ring-blue-600/30"
                    : "bg-bg-elevated text-muted-foreground border border-border"
              )}
            >
              {isComplete ? "✓" : step}
            </div>
            {i < total - 1 && (
              <div
                className={cn(
                  "w-6 h-px mx-0.5 transition-all",
                  isComplete ? "bg-blue-600" : "bg-border"
                )}
              />
            )}
          </div>
        )
      })}
      <span className="ml-2 text-xs text-muted-foreground">
        Step {currentStep} of {total} — {STEP_LABELS[currentStep - 1]}
      </span>
    </div>
  )
}

// ─── Step 1: Identity ────────────────────────────────────────────────────────

function Step1({
  formData,
  setFormData,
  brands,
  models,
}: {
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
  brands: Brand[]
  models: Model[]
}) {
  return (
    <div className="space-y-4 py-4 min-h-[300px]">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">
            Brand <span className="text-red-400">*</span>
          </Label>
          <Select
            value={formData.brand_id}
            onValueChange={(val) =>
              setFormData((p) => ({ ...p, brand_id: val, model_id: "" }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select brand" />
            </SelectTrigger>
            <SelectContent className="bg-bg-card border-border">
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.icon ? `${b.icon} ` : ""}
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">
            Model <span className="text-red-400">*</span>
          </Label>
          <Select
            value={formData.model_id}
            onValueChange={(val) =>
              setFormData((p) => ({ ...p, model_id: val }))
            }
            disabled={!formData.brand_id || models.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  formData.brand_id
                    ? models.length === 0
                      ? "Loading…"
                      : "Select model"
                    : "Select brand first"
                }
              />
            </SelectTrigger>
            <SelectContent className="bg-bg-card border-border max-h-60">
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">
            Reference Number <span className="text-red-400">*</span>
          </Label>
          <Input
            value={formData.reference_number}
            onChange={(e) =>
              setFormData((p) => ({ ...p, reference_number: e.target.value }))
            }
            placeholder="e.g. 126610LN"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">
            Year <span className="text-red-400">*</span>
          </Label>
          <Input
            type="number"
            min={1950}
            max={2026}
            value={formData.year}
            onChange={(e) =>
              setFormData((p) => ({ ...p, year: e.target.value }))
            }
            placeholder="e.g. 2022"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">
          Serial Number{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          value={formData.serial_number}
          onChange={(e) =>
            setFormData((p) => ({ ...p, serial_number: e.target.value }))
          }
          placeholder="e.g. 7B27XXXX"
        />
      </div>
    </div>
  )
}

// ─── Step 2: Details ─────────────────────────────────────────────────────────

function Step2({
  formData,
  setFormData,
}: {
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
}) {
  function toggleComplication(val: string) {
    setFormData((p) => ({
      ...p,
      complications: p.complications.includes(val)
        ? p.complications.filter((c) => c !== val)
        : [...p.complications, val],
    }))
  }

  return (
    <div className="space-y-4 py-4 min-h-[300px]">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">
            Material <span className="text-red-400">*</span>
          </Label>
          <Select
            value={formData.material}
            onValueChange={(val) =>
              setFormData((p) => ({ ...p, material: val }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select material" />
            </SelectTrigger>
            <SelectContent className="bg-bg-card border-border">
              {MATERIALS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">
            Dial Color <span className="text-red-400">*</span>
          </Label>
          <Select
            value={formData.dial_color}
            onValueChange={(val) =>
              setFormData((p) => ({ ...p, dial_color: val }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select dial color" />
            </SelectTrigger>
            <SelectContent className="bg-bg-card border-border max-h-60">
              {DIAL_COLORS.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">
            Case Size{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Select
            value={formData.case_size}
            onValueChange={(val) =>
              setFormData((p) => ({ ...p, case_size: val }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent className="bg-bg-card border-border">
              {CASE_SIZES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">
            Movement{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Select
            value={formData.movement}
            onValueChange={(val) =>
              setFormData((p) => ({ ...p, movement: val }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select movement" />
            </SelectTrigger>
            <SelectContent className="bg-bg-card border-border">
              {MOVEMENTS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">
          Complications{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <div className="grid grid-cols-2 gap-2 p-3 bg-bg-elevated rounded-lg border border-border">
          {COMPLICATIONS.map((comp) => (
            <label
              key={comp}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={formData.complications.includes(comp)}
                onChange={() => toggleComplication(comp)}
                className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
              />
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                {comp}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">
            Condition <span className="text-red-400">*</span>
          </Label>
          <Select
            value={formData.condition}
            onValueChange={(val) =>
              setFormData((p) => ({ ...p, condition: val }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select condition" />
            </SelectTrigger>
            <SelectContent className="bg-bg-card border-border">
              {CONDITIONS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">
            Condition Score{" "}
            <span className="text-muted-foreground font-normal">
              (0–10, optional)
            </span>
          </Label>
          <Input
            type="number"
            min={0}
            max={10}
            step={0.5}
            value={formData.condition_score}
            onChange={(e) =>
              setFormData((p) => ({ ...p, condition_score: e.target.value }))
            }
            placeholder="e.g. 9.5"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Completeness ────────────────────────────────────────────────────

function Step3({
  formData,
  setFormData,
}: {
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
}) {
  return (
    <div className="space-y-5 py-4 min-h-[300px]">
      <div className="space-y-3">
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-foreground">Original Box</p>
            <p className="text-xs text-muted-foreground">Manufacturer box included</p>
          </div>
          <Switch
            checked={formData.has_box}
            onCheckedChange={(val) =>
              setFormData((p) => ({ ...p, has_box: val }))
            }
          />
        </div>

        <Separator className="bg-border" />

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-foreground">Papers / Certificate</p>
            <p className="text-xs text-muted-foreground">Original warranty card or certificate</p>
          </div>
          <Switch
            checked={formData.has_papers}
            onCheckedChange={(val) =>
              setFormData((p) => ({ ...p, has_papers: val }))
            }
          />
        </div>

        <Separator className="bg-border" />

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-foreground">Active Warranty</p>
            <p className="text-xs text-muted-foreground">Manufacturer warranty still active</p>
          </div>
          <Switch
            checked={formData.has_warranty}
            onCheckedChange={(val) =>
              setFormData((p) => ({
                ...p,
                has_warranty: val,
                warranty_date: val ? p.warranty_date : "",
              }))
            }
          />
        </div>
      </div>

      {formData.has_warranty && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">
            Warranty Expiry Date
          </Label>
          <Input
            type="date"
            value={formData.warranty_date}
            onChange={(e) =>
              setFormData((p) => ({ ...p, warranty_date: e.target.value }))
            }
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">
          Service History{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          value={formData.service_history}
          onChange={(e) =>
            setFormData((p) => ({ ...p, service_history: e.target.value }))
          }
          placeholder="e.g. Full service performed by Rolex in 2023"
          className="resize-none h-20"
        />
      </div>
    </div>
  )
}

// ─── Step 4: Pricing ─────────────────────────────────────────────────────────

function Step4({
  formData,
  setFormData,
}: {
  formData: FormData
  setFormData: React.Dispatch<React.SetStateAction<FormData>>
}) {
  return (
    <div className="space-y-5 py-4 min-h-[300px]">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">
          Wholesale Price <span className="text-red-400">*</span>
        </Label>
        <CurrencyInput
          value={formData.wholesale_price}
          onChange={(val) =>
            setFormData((p) => ({ ...p, wholesale_price: val }))
          }
          placeholder="Dealer acquisition price"
        />
        <p className="text-xs text-muted-foreground">
          Your cost — only visible to you and network dealers
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">
          Retail Price{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <CurrencyInput
          value={formData.retail_price}
          onChange={(val) =>
            setFormData((p) => ({ ...p, retail_price: val }))
          }
          placeholder="Public asking price (Phase 2)"
        />
        <p className="text-xs text-muted-foreground">
          Will be used for public buyer marketplace in Phase 2
        </p>
      </div>

      <Separator className="bg-border" />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Accept Inquiries</p>
          <p className="text-xs text-muted-foreground">
            Allow other dealers to send deal inquiries
          </p>
        </div>
        <Switch
          checked={formData.accepts_inquiries}
          onCheckedChange={(val) =>
            setFormData((p) => ({ ...p, accepts_inquiries: val }))
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">
          Notes{" "}
          <span className="text-muted-foreground font-normal">
            (optional, max 2000 chars)
          </span>
        </Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => {
            if (e.target.value.length <= 2000) {
              setFormData((p) => ({ ...p, notes: e.target.value }))
            }
          }}
          placeholder="Additional details, provenance, asking terms…"
          className="resize-none h-24"
        />
        <p className="text-xs text-muted-foreground text-right">
          {formData.notes.length} / 2000
        </p>
      </div>
    </div>
  )
}

// ─── Step 5: Review ──────────────────────────────────────────────────────────

function Step5({
  formData,
  brands,
  models,
}: {
  formData: FormData
  brands: Brand[]
  models: Model[]
}) {
  const brand = brands.find((b) => b.id === formData.brand_id)
  const model = models.find((m) => m.id === formData.model_id)

  function Row({
    label,
    value,
  }: {
    label: string
    value: string | React.ReactNode
  }) {
    if (!value) return null
    return (
      <div className="flex justify-between gap-4 py-1.5 text-sm">
        <span className="text-muted-foreground shrink-0">{label}</span>
        <span className="text-foreground font-medium text-right">{value}</span>
      </div>
    )
  }

  return (
    <div className="space-y-5 py-4 min-h-[300px]">
      <div className="bg-bg-elevated rounded-lg border border-border p-4 space-y-1">
        <p className="text-xs text-[var(--ow-text-faint)] uppercase tracking-wider font-semibold mb-3">
          Watch Details
        </p>
        <Row label="Brand" value={brand?.name ?? "—"} />
        <Row label="Model" value={model?.name ?? "—"} />
        <Row label="Reference" value={formData.reference_number} />
        <Row label="Year" value={formData.year} />
        {formData.serial_number && (
          <Row label="Serial" value={formData.serial_number} />
        )}
        <Row label="Material" value={formData.material} />
        <Row label="Dial" value={formData.dial_color} />
        {formData.case_size && (
          <Row label="Case Size" value={formData.case_size} />
        )}
        {formData.movement && (
          <Row label="Movement" value={formData.movement} />
        )}
        {formData.complications.length > 0 && (
          <Row
            label="Complications"
            value={formData.complications.join(", ")}
          />
        )}
        <Row label="Condition" value={formData.condition} />
        {formData.condition_score && (
          <Row label="Score" value={`${formData.condition_score}/10`} />
        )}
      </div>

      <div className="bg-bg-elevated rounded-lg border border-border p-4 space-y-1">
        <p className="text-xs text-[var(--ow-text-faint)] uppercase tracking-wider font-semibold mb-3">
          Pricing & Completeness
        </p>
        <Row
          label="Wholesale Price"
          value={
            formData.wholesale_price ? (
              <span className="font-mono">
                ${parseFloat(formData.wholesale_price).toLocaleString()}
              </span>
            ) : (
              "—"
            )
          }
        />
        {formData.retail_price && (
          <Row
            label="Retail Price"
            value={
              <span className="font-mono">
                ${parseFloat(formData.retail_price).toLocaleString()}
              </span>
            }
          />
        )}
        <Row
          label="Box"
          value={
            <span
              className={
                formData.has_box ? "text-green-400" : "text-muted-foreground"
              }
            >
              {formData.has_box ? "Yes" : "No"}
            </span>
          }
        />
        <Row
          label="Papers"
          value={
            <span
              className={
                formData.has_papers
                  ? "text-green-400"
                  : "text-muted-foreground"
              }
            >
              {formData.has_papers ? "Yes" : "No"}
            </span>
          }
        />
        <Row
          label="Warranty"
          value={
            <span
              className={
                formData.has_warranty
                  ? "text-green-400"
                  : "text-muted-foreground"
              }
            >
              {formData.has_warranty ? "Yes" : "No"}
            </span>
          }
        />
        <Row
          label="Accepts Inquiries"
          value={
            <span
              className={
                formData.accepts_inquiries
                  ? "text-green-400"
                  : "text-muted-foreground"
              }
            >
              {formData.accepts_inquiries ? "Yes" : "No"}
            </span>
          }
        />
      </div>
    </div>
  )
}

// ─── Main Dialog ─────────────────────────────────────────────────────────────

export default function AddWatchDialog({
  brands,
  userId,
  onSuccess,
  open,
  onOpenChange,
}: AddWatchDialogProps) {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(false)

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(1)
      setFormData(initialFormData)
      setModels([])
    }
  }, [open])

  // Fetch models when brand changes
  useEffect(() => {
    if (!formData.brand_id) {
      setModels([])
      return
    }
    const supabase = createClient()
    supabase
      .from("models")
      .select("*")
      .eq("brand_id", formData.brand_id)
      .is("deleted_at", null)
      .order("name")
      .then(({ data }) => setModels((data as Model[]) || []))
  }, [formData.brand_id])

  function isStepValid(): boolean {
    switch (step) {
      case 1:
        return !!(
          formData.brand_id &&
          formData.model_id &&
          formData.reference_number.trim() &&
          formData.year
        )
      case 2:
        return !!(
          formData.material &&
          formData.dial_color &&
          formData.condition
        )
      case 3:
        return true
      case 4:
        return !!formData.wholesale_price
      case 5:
        return true
      default:
        return false
    }
  }

  async function handleSubmit() {
    if (!formData.wholesale_price) return
    setLoading(true)
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          year: parseInt(formData.year),
          condition_score: formData.condition_score
            ? parseFloat(formData.condition_score)
            : null,
          complications: formData.complications.filter(Boolean),
        }),
      })

      if (res.ok) {
        toast.success("Watch listed successfully!")
        onSuccess()
        onOpenChange(false)
      } else {
        const e = await res.json()
        toast.error(e.error || "Failed to create listing")
      }
    } catch {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground text-lg font-bold">
            Add Watch to Inventory
          </DialogTitle>
          <StepIndicator currentStep={step} total={5} />
        </DialogHeader>

        {/* Step content */}
        {step === 1 && (
          <Step1
            formData={formData}
            setFormData={setFormData}
            brands={brands}
            models={models}
          />
        )}
        {step === 2 && (
          <Step2 formData={formData} setFormData={setFormData} />
        )}
        {step === 3 && (
          <Step3 formData={formData} setFormData={setFormData} />
        )}
        {step === 4 && (
          <Step4 formData={formData} setFormData={setFormData} />
        )}
        {step === 5 && (
          <Step5 formData={formData} brands={brands} models={models} />
        )}

        <DialogFooter className="gap-2 pt-2">
          {step > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep((s) => s - 1)}
              disabled={loading}
              className="border-border text-foreground hover:bg-bg-elevated"
            >
              Back
            </Button>
          )}

          {step < 5 ? (
            <Button
              size="sm"
              onClick={() => setStep((s) => s + 1)}
              disabled={!isStepValid()}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:opacity-90 border-0"
            >
              Next
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={loading || !formData.wholesale_price}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:opacity-90 border-0"
            >
              {loading ? "Submitting…" : "Submit Listing"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
