import { useId, useState, type JSX, type ReactNode } from 'react'
import { IconChevronDownOutlineRegular, Menu, Switch } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './MnemonSettingsCard.module.css'

/** One option of a settings selector; the detail explains it in the menu and under the row title. */
export interface SettingOption<T extends string> {
  value: T
  label: string
  detail?: string
  disabled?: boolean
}

/**
 * A DSH preference row: title and hint on the left, one control on the right.
 * Shared by Mnemon Settings and the Plugins page composition.
 */
export function SettingRow(props: { title: string; titleId?: string | undefined; hint?: ReactNode; htmlFor?: string | undefined; children?: ReactNode; stacked?: boolean | undefined }): JSX.Element {
  const title = props.htmlFor === undefined
    ? <strong id={props.titleId}>{props.title}</strong>
    : <label id={props.titleId} htmlFor={props.htmlFor}><strong>{props.title}</strong></label>
  return <div className={css.settingRow} data-stacked={props.stacked === true ? '' : undefined}>
    <div className={css.settingCopy}>{title}{props.hint !== undefined && props.hint !== '' && <small>{props.hint}</small>}</div>
    {props.children !== undefined && <div className={css.settingControl}>{props.children}</div>}
  </div>
}

/** The DSH settings selector: a gray button that opens a Menu of the options. */
export function SettingSelect<T extends string>(props: { labelledBy: string; value: T; options: readonly SettingOption<T>[]; disabled?: boolean | undefined; onChange: (value: T) => void }): JSX.Element {
  const [open, setOpen] = useState(false)
  const valueId = useId()
  const current = props.options.find(option => option.value === props.value)
  return <Menu
    open={open}
    onClose={() => setOpen(false)}
    align="end"
    portal
    selectedId={props.value}
    listClassName={css.selectMenu}
    items={props.options.map(option => ({
      id: option.value,
      label: option.detail === undefined ? option.label : <span className={css.selectOption}><span>{option.label}</span><small>{option.detail}</small></span>,
      ...(option.disabled === true ? { disabled: true } : {}),
    }))}
    onSelect={id => { setOpen(false); if (id !== props.value) props.onChange(id as T) }}
    anchor={<button type="button" className={css.selector} aria-haspopup="menu" aria-expanded={open} aria-labelledby={`${props.labelledBy} ${valueId}`} disabled={props.disabled} onClick={() => setOpen(value => !value)}>
      <span id={valueId}>{current?.label ?? props.value}</span>
      <IconChevronDownOutlineRegular size={12} />
    </button>}
  />
}

/** A row whose control is a selector; the chosen option's detail doubles as the hint. */
export function SelectRow<T extends string>(props: { id: string; label: string; hint?: string | undefined; value: T; options: readonly SettingOption<T>[]; disabled?: boolean | undefined; onChange: (value: T) => void }): JSX.Element {
  const titleId = `${props.id}-title`
  const detail = props.options.find(option => option.value === props.value)?.detail
  return <SettingRow title={props.label} titleId={titleId} hint={props.hint ?? detail}>
    <SettingSelect labelledBy={titleId} value={props.value} options={props.options} disabled={props.disabled === true} onChange={props.onChange} />
  </SettingRow>
}

/** A row whose control is the DSH Switch. */
export function ToggleRow(props: { id: string; label: string; hint: string; checked: boolean; disabled: boolean; ariaLabel?: string | undefined; onChange: (value: boolean) => void }): JSX.Element {
  return <div className={css.toggleRow} id={props.id}>
    <span className={css.settingCopy}><strong>{props.label}</strong>{props.hint !== '' && <small>{props.hint}</small>}</span>
    <Switch className={css.switch} checked={props.checked} label={props.ariaLabel ?? props.label} disabled={props.disabled} onChange={props.onChange} />
  </div>
}
