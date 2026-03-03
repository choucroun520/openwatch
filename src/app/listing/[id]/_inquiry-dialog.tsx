"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { CheckCircle } from "lucide-react";
import type { ListingWithRelations } from "@/lib/types";

interface InquiryDialogProps {
  listing: ListingWithRelations;
}

export default function InquiryDialog({ listing }: InquiryDialogProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (message.trim().length < 10) {
      toast.error("Message must be at least 10 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listing.id,
          message: message.trim(),
          offer_price: offerPrice.trim() || undefined,
        }),
      });

      if (res.ok) {
        setSent(true);
        toast.success("Inquiry sent!");
        setTimeout(() => {
          setOpen(false);
          // Reset state after dialog closes
          setTimeout(() => {
            setSent(false);
            setMessage("");
            setOfferPrice("");
          }, 300);
        }, 1500);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to send inquiry");
      }
    } catch {
      toast.error("Failed to send inquiry. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full mt-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:opacity-90 transition-opacity">
          Send Inquiry
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-bg-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Inquiry — {listing.brand.name} {listing.model?.name}{" "}
            {listing.reference_number}
          </DialogTitle>
        </DialogHeader>

        {sent ? (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <CheckCircle className="w-12 h-12 text-green-400" />
            <p className="text-foreground font-semibold">Inquiry Sent!</p>
            <p className="text-sm text-muted-foreground">
              The dealer will be notified and respond shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Message <span className="text-danger">*</span>
              </label>
              <Textarea
                placeholder="Describe your interest, ask questions, or propose terms..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                minLength={10}
                rows={4}
                className="bg-bg-elevated border-border text-foreground placeholder:text-muted-foreground resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Offer Price{" "}
                <span className="text-muted-foreground text-xs font-normal">
                  (optional)
                </span>
              </label>
              <Input
                type="text"
                placeholder="e.g. $45,000 — leave blank to inquire without price"
                value={offerPrice}
                onChange={(e) => setOfferPrice(e.target.value)}
                className="bg-bg-elevated border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Inquiry"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
