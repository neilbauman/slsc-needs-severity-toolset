"use client";

import { useState } from "react";
import { createClientComponentClient } from "@/lib/supabaseClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface CleanNumericDatasetModalProps {
  datasetId: string;
  datasetName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCleaned: () => Promise<void>;
}

export default function CleanNumericDatasetModal({
  datasetId,
  datasetName,
  open,
  onOpenChange,
  onCleaned,
}: CleanNumericDatasetModalProps) {
  const supabase = createClientComponentClient();
  const [isCleaning, setIsCleaning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [method, setMethod] = useState("v11");
  const [result, setResult] = useState<{ total_cleaned?: number; cleaned_at?: string } | null>(null);

  const cleaningOptions = [
    {
      value: "v11",
      label: "PCode Match Only (Fast, Exact)",
      description: "Matches rows by exact or truncated pcode only (ADM4 focus).",
    },
    {
      value: "v12",
      label: "PCode Hierarchical (ADM3/ADM2)",
      description: "Matches pcodes and aggregates child admin levels if needed.",
    },
    {
      value: "v13",
      label: "Fuzzy Name Match (Coming Soon)",
      description: "Uses name similarity for unmatched rows (disabled).",
      disabled: true,
    },
  ];

  const handleClean = async () => {
    setIsCleaning(true);
    setProgress(10);
    setResult(null);

    try {
      toast.info("Starting cleaning process...");

      const rpcName =
        method === "v11"
          ? "clean_dataset_v11"
          : method === "v12"
          ? "clean_dataset_v12"
          : "clean_dataset_v11"; // fallback

      // Run the RPC
      const { error } = await supabase.rpc(rpcName, { in_dataset_id: datasetId });

      if (error) throw error;

      setProgress(90);

      // Fetch results from audit log
      const { data: logs, error: logError } = await supabase
        .from("dataset_cleaning_audit_log")
        .select("cleaned_at, total_cleaned")
        .eq("dataset_id", datasetId)
        .order("cleaned_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (logError) throw logError;

      setResult(logs || {});
      setProgress(100);
      toast.success("Cleaning completed successfully!");
      await onCleaned();
    } catch (err: any) {
      console.error("Cleaning error:", err);
      toast.error(`Error: ${err.message || "Unknown cleaning error"}`);
    } finally {
      setIsCleaning(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Clean Dataset: {datasetName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium">Cleaning Method</label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Select cleaning strategy..." />
              </SelectTrigger>
              <SelectContent>
                {cleaningOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
                    <div>
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCleaning}>
              Cancel
            </Button>
            <Button onClick={handleClean} disabled={isCleaning}>
              {isCleaning ? "Cleaning..." : "Start Cleaning"}
            </Button>
          </div>

          {isCleaning && (
            <div className="mt-4">
              <Progress value={progress} className="w-full" />
              <p className="text-xs text-muted-foreground mt-2">Cleaning in progress...</p>
            </div>
          )}

          {result && (
            <div className="mt-4 border rounded-md p-3 bg-muted/40">
              <p className="text-sm">
                <strong>Last Cleaned:</strong>{" "}
                {new Date(result.cleaned_at || "").toLocaleString() || "N/A"}
              </p>
              <p className="text-sm">
                <strong>Total Cleaned Rows:</strong> {result.total_cleaned || 0}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
