// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.


import { todayLocalISO } from '../../utils/date';
import { useState, type ChangeEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAiOcrReceipt } from '../../api/hooks/useAi';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { DatePicker } from '../../components/forms/DatePicker';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { X, Camera, Brain, Sparkles, Loader2 } from 'lucide-react';
import { AiBannerForTask } from '../../components/ui/AiBannerForTask';
import { OcrQualityNotice } from '../../components/ui/OcrQualityNotice';

interface ReceiptCaptureModalProps { onClose: () => void }

export function ReceiptCaptureModal({ onClose }: ReceiptCaptureModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [attachmentId, setAttachmentId] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<{ vendor: string; date: string; total: string; tax: string } | null>(null);
  const [qualityWarnings, setQualityWarnings] = useState<string[]>([]);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  // Populated only when OCR ran without a downstream text structurer —
  // we still have OCR'd text but no structured vendor/total/date.
  // Renders as a read-only textarea so the user can copy values into the
  // form fields manually.
  const [rawOcrText, setRawOcrText] = useState<string | null>(null);
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [payFromAccountId, setPayFromAccountId] = useState('');
  const queryClient = useQueryClient();
  const aiOcr = useAiOcrReceipt();

  const uploadMutation = useMutation({
    mutationFn: async (f: File) => {
      const formData = new FormData();
      formData.append('file', f);
      formData.append('attachableType', 'receipt');
      formData.append('attachableId', crypto.randomUUID());
      const res = await fetch(`${import.meta.env.BASE_URL}api/v1/attachments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    },
    onSuccess: async (data: { id?: string; attachment?: { id: string } }) => {
      const aid = data.id || data.attachment?.id;
      if (!aid) return;
      setAttachmentId(aid);

      // Auto-trigger AI OCR
      setOcrProcessing(true);
      try {
        const result = await aiOcr.mutateAsync(aid);
        setOcrResult({
          vendor: result.vendor || '',
          date: result.date || todayLocalISO(),
          total: result.total || '',
          tax: result.tax || '0',
        });
        setOcrConfidence(result.confidence ?? null);
        setQualityWarnings(Array.isArray(result.qualityWarnings) ? result.qualityWarnings : []);
        // OCR ran without a text structurer: backend returns
        // `status: 'ocr_only'` + raw OCR text. Surface the text so the
        // user can fill the form manually instead of seeing empty fields.
        if (result.status === 'ocr_only' && result.rawText) {
          setRawOcrText(result.rawText);
        } else {
          setRawOcrText(null);
        }
      } catch {
        // OCR failed — useAiOcrReceipt's onError toast already explained
        // why. Open an empty form so the user can still create the
        // expense manually instead of being stuck on a broken modal.
        setOcrResult({ vendor: '', date: todayLocalISO(), total: '', tax: '0' });
        setRawOcrText(null);
      } finally {
        setOcrProcessing(false);
      }
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: async () => {
      if (!ocrResult || !expenseAccountId || !payFromAccountId) return;
      const res = await fetch(`${import.meta.env.BASE_URL}api/v1/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: JSON.stringify({
          txnType: 'expense',
          txnDate: ocrResult.date,
          payFromAccountId,
          expenseAccountId,
          amount: ocrResult.total,
          memo: ocrResult.vendor ? `Receipt: ${ocrResult.vendor}` : 'Receipt expense',
        }),
      });
      if (!res.ok) throw new Error('Failed to create expense');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      onClose();
    },
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    uploadMutation.mutate(f);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Capture Receipt</h2>
            <AiBannerForTask task="receipt_ocr" />
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-4 overflow-auto flex-1">
          {!file ? (
            <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary-400"
              onClick={() => document.getElementById('receipt-input')?.click()}>
              <input id="receipt-input" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <Camera className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Take a photo or upload a receipt image</p>
              <p className="text-xs text-gray-400 mt-1">AI will automatically extract vendor, date, and total</p>
            </div>
          ) : (
            <>
              {preview && <img src={preview} alt="Receipt" className="max-h-48 mx-auto rounded-lg" />}

              {/* Processing state */}
              {(uploadMutation.isPending || ocrProcessing) && (
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="h-5 w-5 text-primary-600 animate-spin" />
                  <span className="text-sm text-gray-600">
                    {uploadMutation.isPending ? 'Uploading...' : 'AI extracting receipt data...'}
                  </span>
                </div>
              )}

              {/* OCR ran but no text LLM is configured to structure
                  its output into vendor/date/total. Show the raw OCR
                  text so the user can copy values into the form below. */}
              {rawOcrText && !ocrProcessing && (
                <div className="space-y-2 border-t pt-4 bg-amber-50 -mx-2 px-2 py-3 rounded">
                  <p className="text-sm font-medium text-amber-900 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" />
                    OCR text only — no text LLM configured
                  </p>
                  <p className="text-xs text-amber-800">
                    Your OCR provider extracted the text below but no text LLM is set up to
                    structure it. Pick a text model in System Settings → AI → Tasks
                    (categorization provider) to enable auto-fill, or copy values into the form
                    manually.
                  </p>
                  <textarea
                    readOnly
                    value={rawOcrText}
                    rows={6}
                    className="w-full text-xs font-mono bg-white border border-amber-200 rounded px-2 py-1.5"
                  />
                </div>
              )}

              {ocrResult && !ocrProcessing && (
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-primary-500" />
                      {rawOcrText
                        ? 'Manual entry — copy from OCR text above'
                        : `Receipt Details ${ocrConfidence && ocrConfidence > 0 ? '(AI extracted)' : '(manual entry)'}`}
                    </p>
                    {ocrConfidence && ocrConfidence > 0 && !rawOcrText && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ocrConfidence >= 0.8 && !qualityWarnings.includes('tesseract_local_ocr') ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {Math.round(ocrConfidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                  {/* In OCR-only mode the user is filling fields manually
                      from the raw text above, so the quality-notice for
                      structured extraction is irrelevant. */}
                  {!rawOcrText && <OcrQualityNotice warnings={qualityWarnings} />}
                  <Input label="Vendor" value={ocrResult.vendor} onChange={(e) => setOcrResult({ ...ocrResult, vendor: e.target.value })} />
                  <DatePicker label="Date" value={ocrResult.date} onChange={(e) => setOcrResult({ ...ocrResult, date: e.target.value })} />
                  <MoneyInput label="Total" value={ocrResult.total} onChange={(v) => setOcrResult({ ...ocrResult, total: v })} />
                  <MoneyInput label="Tax" value={ocrResult.tax} onChange={(v) => setOcrResult({ ...ocrResult, tax: v })} />

                  <hr />
                  <AccountSelector label="Expense Account" value={expenseAccountId} onChange={setExpenseAccountId} />
                  <AccountSelector label="Paid From" value={payFromAccountId} onChange={setPayFromAccountId} accountTypeFilter={['asset', 'liability']} />
                </div>
              )}
            </>
          )}
        </div>

        {ocrResult && !ocrProcessing && (
          <div className="flex justify-end gap-3 px-6 py-4 border-t">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => createExpenseMutation.mutate()}
              disabled={!ocrResult.total || !expenseAccountId || !payFromAccountId}
              loading={createExpenseMutation.isPending}>
              Create Expense
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
