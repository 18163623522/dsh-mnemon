import { useEffect, useMemo, useRef, useState, type ChangeEvent, type JSX } from 'react'
import type { ClientConnectionHandle, MnemonPackExport, MnemonPackPreview } from "../host/protocol.ts"
import { MnemonClient } from './api.ts'
import type { MnemonTranslate } from './locales.ts'
import { humanBytes, message } from './page-kit.tsx'
import css from './MnemonSettingsCard.module.css'
import { SettingRow } from './settings-controls.tsx'

interface MnemonPackSectionProps {
  connection?: ClientConnectionHandle
  sessionId?: string
  workspaceId?: string
  refreshKey: number
  t: MnemonTranslate
}

interface PendingZip {
  base64: string
  preview: MnemonPackPreview
}

const ZIP_ACCEPT = '.zip,application/zip'

function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('Could not read ZIP file'))
    reader.onload = () => {
      const value = reader.result
      if (typeof value !== 'string') return reject(new Error('Could not read ZIP file'))
      const separator = value.indexOf(',')
      if (separator < 0) return reject(new Error('ZIP file encoding is invalid'))
      resolve(value.slice(separator + 1))
    }
    reader.readAsDataURL(file)
  })
}

function bytesFromBase64(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return buffer
}

function download(result: MnemonPackExport): void {
  const blob = new Blob([bytesFromBase64(result.base64)], { type: result.mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = result.fileName; anchor.hidden = true
  document.body.append(anchor); anchor.click(); anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function MnemonPackSection({ connection, sessionId, workspaceId, refreshKey, t }: MnemonPackSectionProps): JSX.Element {
  const client = useMemo(() => connection === undefined ? null : new MnemonClient(connection, sessionId, workspaceId), [connection, sessionId, workspaceId])
  const input = useRef<HTMLInputElement | null>(null)
  const [target, setTarget] = useState<{ root: string; scope: 'global' | 'workspace' | 'custom' } | null>(null)
  const [pending, setPending] = useState<PendingZip | null>(null)
  const [busy, setBusy] = useState<'target' | 'export' | 'inspect' | 'import' | null>(client === null ? null : 'target')
  const [failed, setFailed] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (client === null) return
    setBusy('target'); setFailed(null)
    void client.packTarget().then(value => { if (active) setTarget(value) }).catch(reason => {
      if (active) setFailed(message(reason))
    }).finally(() => { if (active) setBusy(null) })
    return () => { active = false }
  }, [client, refreshKey])

  const exportZip = async (): Promise<void> => {
    if (client === null || busy !== null) return
    setBusy('export'); setFailed(null); setNotice(null)
    try {
      const result = await client.exportPack()
      download(result)
      setNotice(t('config.packExported', { file: result.fileName, size: humanBytes(result.bytes) }))
    } catch (reason) {
      setFailed(message(reason))
    } finally { setBusy(null) }
  }

  const inspectZip = async (file: File): Promise<void> => {
    if (client === null || busy !== null) return
    setBusy('inspect'); setFailed(null); setNotice(null); setPending(null)
    try {
      const base64 = await fileBase64(file)
      const preview = await client.inspectPack(base64, file.name)
      setPending({ base64, preview })
    } catch (reason) {
      setFailed(message(reason))
    } finally { setBusy(null) }
  }

  const chooseFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (file !== undefined) void inspectZip(file)
  }

  const importZip = async (): Promise<void> => {
    if (client === null || pending === null || busy !== null) return
    setBusy('import'); setFailed(null); setNotice(null)
    try {
      const result = await client.importPack(pending.base64)
      setNotice(t('config.packImportedWhole', { root: result.targetRoot }))
      setPending(null)
    } catch (reason) {
      setFailed(message(reason))
    } finally { setBusy(null) }
  }

  const items = pending?.preview.manifest.summary.reduce((sum, component) => sum + component.items, 0) ?? 0

  return <div className={css.packRow} role="group" aria-labelledby="mnemon-pack-heading">
    <SettingRow title={t('config.packTitle')} titleId="mnemon-pack-heading" hint={<>{t('config.packSimpleDescription')}<code className={css.activePath} title={target?.root}>{target?.root ?? t('config.packTargetLoading')}</code></>}>
      <div className={css.rowActions}>
        <button type="button" className={css.pillButton} disabled={client === null || busy !== null} onClick={() => input.current?.click()}>{busy === 'inspect' ? t('config.packInspecting') : t('config.packImportZip')}</button>
        <button type="button" className={css.pillButton} disabled={client === null || busy !== null || target === null} onClick={() => void exportZip()}>{busy === 'export' ? t('config.packExporting') : t('config.packExportZip')}</button>
      </div>
      <input ref={input} className={css.visuallyHidden} type="file" accept={ZIP_ACCEPT} aria-label={t('config.packChooseZip')} onChange={chooseFile} />
    </SettingRow>
    {pending !== null && <div className={css.importBar} role="status">
      <div><strong>{pending.preview.fileName ?? t('config.packUnnamedZip')}</strong><small>{t('config.packZipReady', { components: pending.preview.manifest.components.length, items, size: humanBytes(pending.preview.archiveBytes) })}</small></div>
      <button type="button" className={css.textButton} disabled={busy !== null} onClick={() => setPending(null)}>{t('common.cancel')}</button>
      <button type="button" className={css.primaryPill} disabled={busy !== null} onClick={() => void importZip()}>{busy === 'import' ? t('config.packImporting') : t('config.packImportZipAction')}</button>
    </div>}
    <div className={css.packFeedback} aria-live="polite">
      {failed !== null && <p className={css.error} role="alert">{t('config.packFailed', { error: failed })}</p>}
      {notice !== null && <p className={css.packSuccess}>{notice}</p>}
      {client === null && <p className={css.readOnly}>{t('config.packUnavailable')}</p>}
    </div>
  </div>
}
