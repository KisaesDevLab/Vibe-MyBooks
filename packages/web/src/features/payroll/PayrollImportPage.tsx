import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { usePayrollUpload, usePayrollTemplates } from '../../api/hooks/usePayrollImport';
import { ColumnMapper } from './ColumnMapper';
import { DescriptionMapper } from './DescriptionMapper';
import { ValidationResults } from './ValidationResults';
import { JEPreview } from './JEPreview';
import { ProviderGuide } from './ProviderGuide';

type Step = 'upload' | 'mapping' | 'validation' | 'preview' | 'done';

export function PayrollImportPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('upload');
  const [sessionId, setSessionId] = useState<string>('');
  const [importMode, setImportMode] = useState<string>('');
  const [uploadResult, setUploadResult] = useState<any>(null);

  const uploadMutation = usePayrollUpload();
  const { data: templateData } = usePayrollTemplates();
  const templates = templateData?.templates || [];

  const [mainFile, setMainFile] = useState<File | null>(null);
  const [companionFile, setCompanionFile] = useState<File | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length >= 1) setMainFile(files[0]!);
    if (files.length >= 2) setCompanionFile(files[1]!);
  }, []);

  const handleUpload = async () => {
    if (!mainFile) return;
    const result = await uploadMutation.mutateAsync({
      file: mainFile,
      companionFile: companionFile || undefined,
      templateId: selectedTemplate || undefined,
    });
    setSessionId(result.session.id);
    setImportMode(result.preview.importMode);
    setUploadResult(result);
    setStep('mapping');
  };

  const handleMappingComplete = () => setStep('validation');
  const handleValidationComplete = () => setStep('preview');
  const handlePostComplete = () => setStep('done');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Import Payroll</h1>
        <Button variant="secondary" onClick={() => navigate('/payroll/imports')}>
          Import History
        </Button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {(['upload', 'mapping', 'validation', 'preview'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === s ? 'bg-primary-600 text-white' :
              (['upload', 'mapping', 'validation', 'preview'].indexOf(step) > i) ? 'bg-green-500 text-white' :
              'bg-gray-200 text-gray-500'
            }`}>
              {i + 1}
            </div>
            <span className={`ml-2 text-sm ${step === s ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
              {s === 'upload' ? 'Upload' : s === 'mapping' ? 'Map' : s === 'validation' ? 'Validate' : 'Preview & Post'}
            </span>
            {i < 3 && <div className="w-8 h-px bg-gray-300 mx-2" />}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 'upload' && (<>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          {/* Dropzone */}
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              dragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('payroll-file-input')?.click()}
          >
            <input
              id="payroll-file-input"
              type="file"
              className="hidden"
              accept=".csv,.tsv,.xls,.xlsx"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length >= 1) setMainFile(files[0]!);
                if (files.length >= 2) setCompanionFile(files[1]!);
              }}
            />
            <div className="text-gray-500">
              <p className="text-lg font-medium">Drop your payroll file here</p>
              <p className="mt-1 text-sm">or click to browse. Supports CSV, TSV, XLS, XLSX</p>
              <p className="mt-1 text-xs text-gray-400">
                For Payroll Relief: drop both GLEntries.csv and Checks.csv together
              </p>
            </div>
          </div>

          {/* File info */}
          {mainFile && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">{mainFile.name}</p>
                  <p className="text-xs text-gray-500">{(mainFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <button onClick={() => setMainFile(null)} className="text-sm text-red-600 hover:text-red-700">Remove</button>
              </div>
              {companionFile && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{companionFile.name} (companion)</p>
                    <p className="text-xs text-gray-500">{(companionFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button onClick={() => setCompanionFile(null)} className="text-sm text-red-600 hover:text-red-700">Remove</button>
                </div>
              )}
            </div>
          )}

          {/* Template selector */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Provider Template (optional)
            </label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
            >
              <option value="">Auto-detect</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              onClick={handleUpload}
              loading={uploadMutation.isPending}
              disabled={!mainFile}
            >
              Upload & Analyze
            </Button>
          </div>

          {uploadMutation.isError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {(uploadMutation.error as Error).message}
            </div>
          )}
        </div>

        {/* Provider export instructions — separate card */}
        <div className="mt-4 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <ProviderGuide />
        </div>
      </>)}

      {step === 'mapping' && sessionId && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          {/* Auto-detection result */}
          {uploadResult?.preview && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                {uploadResult.preview.detectedProvider && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Provider: {uploadResult.preview.detectedProvider} ({uploadResult.preview.detectedConfidence}%)
                  </span>
                )}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  importMode === 'prebuilt_je' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                }`}>
                  {importMode === 'prebuilt_je' ? 'Mode B: Pre-Built JE Import' : 'Mode A: Employee-Level Import'}
                </span>
                <span className="text-sm text-gray-600">
                  {uploadResult.preview.rowCount} rows
                </span>
                {uploadResult.preview.isDuplicate && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Duplicate file detected
                  </span>
                )}
              </div>
            </div>
          )}

          {importMode === 'prebuilt_je' ? (
            <DescriptionMapper sessionId={sessionId} onComplete={handleMappingComplete} />
          ) : (
            <ColumnMapper
              sessionId={sessionId}
              headers={uploadResult?.preview?.headers || []}
              sampleRows={uploadResult?.preview?.sampleRows || []}
              onComplete={handleMappingComplete}
            />
          )}
        </div>
      )}

      {step === 'validation' && sessionId && (
        <ValidationResults sessionId={sessionId} importMode={importMode} onComplete={handleValidationComplete} />
      )}

      {step === 'preview' && sessionId && (
        <JEPreview sessionId={sessionId} importMode={importMode} onComplete={handlePostComplete} />
      )}

      {step === 'done' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Payroll Posted Successfully</h2>
          <p className="mt-2 text-gray-600">Journal entries have been posted to the general ledger.</p>
          <div className="mt-6 flex gap-3 justify-center">
            <Button onClick={() => navigate('/payroll/imports')}>View Import History</Button>
            <Button variant="secondary" onClick={() => { setStep('upload'); setSessionId(''); setMainFile(null); setCompanionFile(null); }}>
              Import Another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
