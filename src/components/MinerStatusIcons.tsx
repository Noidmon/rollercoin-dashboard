import { resolveAssetUrl } from '../utils/resolveAssetUrl'

function StatusIcon({ imagePath, label }: { imagePath: string; label: string }) {
  return (
    <img src={resolveAssetUrl(imagePath)} alt={label} title={label} className="h-5 w-5 shrink-0" />
  )
}

export default function MinerStatusIcons({
  sellable,
  mergeable,
}: {
  sellable: boolean
  mergeable: boolean
}) {
  return (
    <>
      {sellable === false && (
        <StatusIcon imagePath="rollercoin/icons/sellable_disabled.webp" label="Não vendável" />
      )}
      {mergeable === true && (
        <StatusIcon imagePath="rollercoin/icons/merge_enabled.webp" label="Mergeável" />
      )}
    </>
  )
}
