import CleanNumericDatasetModal from '@/components/CleanNumericDatasetModal';
import CleanCategoricalDatasetModal from '@/components/CleanCategoricalDatasetModal';

// Add these states at the top:
const [showNumericModal, setShowNumericModal] = useState(false);
const [showCategoricalModal, setShowCategoricalModal] = useState(false);

// Add button under your dataset title:
<div className="flex justify-end mt-4">
  <button
    onClick={() =>
      dataset?.type === 'numeric'
        ? setShowNumericModal(true)
        : setShowCategoricalModal(true)
    }
    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
  >
    Clean Dataset
  </button>
</div>

// Mount the modals:
{showNumericModal && (
  <CleanNumericDatasetModal
    datasetId={datasetId}
    datasetName={dataset?.name || ''}
    open={showNumericModal}
    onOpenChange={setShowNumericModal}
    onCleaned={loadAll}
  />
)}

{showCategoricalModal && (
  <CleanCategoricalDatasetModal
    datasetId={datasetId}
    datasetName={dataset?.name || ''}
    open={showCategoricalModal}
    onOpenChange={setShowCategoricalModal}
    onCleaned={loadAll}
  />
)}
