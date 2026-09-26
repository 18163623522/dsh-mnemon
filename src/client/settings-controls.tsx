import type { JSX } from 'react'
import css from './MnemonSettingsCard.module.css'

/** Radio card shared by Mnemon Settings and the Plugins page composition. */
export function ChoiceCard(props: { id: string; name: string; label: string; detail: string; checked: boolean; disabled: boolean; onChange: () => void }): JSX.Element {
  return <label className={css.choiceCard} htmlFor={props.id}><input id={props.id} name={props.name} type="radio" aria-label={props.label} checked={props.checked} disabled={props.disabled} onChange={props.onChange} /><span className={css.choiceFace}><strong>{props.label}</strong><small>{props.detail}</small><span className={css.check} aria-hidden="true">✓</span></span></label>
}

/** Switch row shared by Mnemon Settings and the Plugins page composition. */
export function ToggleRow(props: { id: string; label: string; hint: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void }): JSX.Element {
  return <label className={css.toggleRow} htmlFor={props.id}><span className={css.settingCopy}><strong>{props.label}</strong><small>{props.hint}</small></span><input id={props.id} type="checkbox" aria-label={props.label} checked={props.checked} disabled={props.disabled} onChange={event => props.onChange(event.target.checked)} /><span className={css.switch} aria-hidden="true"><i /></span></label>
}
