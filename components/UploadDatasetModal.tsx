'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

type CsvRow = Record<string, string>;

export default function UploadDatasetModal() {
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [parsedData, setParsedData] = useState<CsvRow[]>([]);
  const [adminPcodeCol, setAdminPcodeCol] = useState<string>();
  const [valueCol, setValueCol] = useState<string>();
  const [categoryCodeCol, setCategoryCodeCol] = useState<string>();
  const [categoryScoreCol, setCategoryScoreCol] = useState<string>();
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data;
        if (data.length > 0) {
          setParsedData(data);
          setCsvHeaders(Object.keys(data[0]));
        }
      },
      error: (err) => setError(err.message),
    });
  };

  const handleSubmit = () => {
    if (!adminPcodeCol) {
      setError('Admin Pcode column is required.');
      return;
    }

    const mappedData = parsedData.map((row) => ({
      admin_pcode: row[adminPcodeCol || ''] || '',
      value: valueCol ? row[valueCol] : undefined,
      category_code: categoryCodeCol ? row[categoryCodeCol] : undefined,
      category_score: categoryScoreCol ? row[categoryScoreCol] : undefined,
    }));

    // TODO: send `mappedData` to Supabase or API route
    console.log('Uploading dataset:', mappedData);

    setError(null);
    alert('Upload simulated. Ready to send to database.');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Upload Dataset</Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <h2 className="text-xl font-semibold mb-2">Upload New Dataset</h2>

        <input type="file" accept=".csv" onChange={handleFileUpload} className="mb-4" />

        {csvHeaders.length > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Admin Pcode *</Label>
                <Select onValueChange={setAdminPcodeCol}>
                  <SelectTrigger><SelectValue placeholder="Select column" /></SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((col) => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Value (numeric)</Label>
                <Select onValueChange={setValueCol}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((col) => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Category Code</Label>
                <Select onValueChange={setCategoryCodeCol}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((col) => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Category Score</Label>
                <Select onValueChange={setCategoryScoreCol}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {csvHeaders.map((col) => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button className="mt-4" onClick={handleSubmit}>
              Submit Dataset
            </Button>

            {error && <p className="text-red-600 text-sm">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
