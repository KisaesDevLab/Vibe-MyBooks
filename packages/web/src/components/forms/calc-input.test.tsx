// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MoneyInput } from './MoneyInput';
import { NumericInput } from './NumericInput';

function ControlledMoney(props: { onChange?: (v: string) => void; allowNegative?: boolean; initial?: string }) {
  const [v, setV] = useState(props.initial ?? '');
  return (
    <MoneyInput
      aria-label="amt"
      value={v}
      allowNegative={props.allowNegative}
      onChange={(next) => { props.onChange?.(next); setV(next); }}
    />
  );
}

describe('MoneyInput calculator', () => {
  it('is a text box (not a spinbutton) with a decimal keyboard and a math hint', () => {
    render(<ControlledMoney />);
    const el = screen.getByRole('textbox', { name: 'amt' });
    expect(el).toHaveAttribute('type', 'text');
    expect(el).toHaveAttribute('inputmode', 'decimal');
    expect(el.getAttribute('title')).toMatch(/145\.15-50/);
  });

  it('evaluates "145.15-50" on Enter and hands the caller "95.15"', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlledMoney onChange={onChange} />);
    const el = screen.getByRole('textbox', { name: 'amt' }) as HTMLInputElement;
    await user.type(el, '145.15-50');
    // Plain prefix flows live; the expression is never passed through.
    expect(onChange).not.toHaveBeenCalledWith('145.15-50');
    expect(onChange).toHaveBeenLastCalledWith('145.15');
    expect(screen.getByRole('status')).toHaveTextContent('= 95.15');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('95.15');
    expect(el.value).toBe('95.15');
    expect(document.activeElement).toBe(el);
  });

  it('evaluates on blur', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<><ControlledMoney onChange={onChange} /><button>other</button></>);
    const el = screen.getByRole('textbox', { name: 'amt' }) as HTMLInputElement;
    await user.type(el, '200*15%');
    await user.click(screen.getByText('other'));
    expect(onChange).toHaveBeenLastCalledWith('30.00');
    expect(el.value).toBe('30.00');
  });

  it('evaluates on Tab', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<><ControlledMoney onChange={onChange} /><input aria-label="next" /></>);
    const el = screen.getByRole('textbox', { name: 'amt' });
    await user.type(el, '$1,000/3');
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith('333.33');
    expect(document.activeElement).toBe(screen.getByLabelText('next'));
  });

  it('shows an error for an invalid expression and never commits it', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<><ControlledMoney onChange={onChange} initial="10" /><button>other</button></>);
    const el = screen.getByRole('textbox', { name: 'amt' }) as HTMLInputElement;
    await user.clear(el);
    onChange.mockClear();
    await user.type(el, '5/0');
    await user.keyboard('{Enter}');
    expect(onChange).not.toHaveBeenCalledWith(expect.stringMatching(/[/]/));
    expect(screen.getByRole('alert')).toHaveTextContent(/divide by zero/i);
    expect(el).toHaveAttribute('aria-invalid', 'true');
    await user.click(screen.getByText('other'));
    expect(screen.getByText(/divide by zero/i)).toBeInTheDocument();
    expect(el.value).toBe('5/0');
    for (const call of onChange.mock.calls) expect(call[0]).toMatch(/^-?\d*\.?\d*$/);
  });

  it('blocks negative results unless allowNegative', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlledMoney onChange={onChange} />);
    const el = screen.getByRole('textbox', { name: 'amt' });
    await user.type(el, '10-25');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent("Amount can't be negative here");
    expect(onChange).not.toHaveBeenCalledWith('-15.00');
  });

  it('allows negative results with allowNegative', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ControlledMoney onChange={onChange} allowNegative />);
    const el = screen.getByRole('textbox', { name: 'amt' });
    await user.type(el, '10-25');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('-15.00');
  });

  it('Enter with an expression does not submit the form; Enter on a plain number still does', async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    const user = userEvent.setup();
    render(<form onSubmit={onSubmit}><ControlledMoney /><button type="submit">Save</button></form>);
    const el = screen.getByRole('textbox', { name: 'amt' });
    await user.type(el, '145.15-50{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    expect((el as HTMLInputElement).value).toBe('95.15');
    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Enter with a pending expression evaluates instead of saving', () => {
    const onFormKey = vi.fn();
    render(<form onKeyDown={onFormKey}><ControlledMoney /></form>);
    const el = screen.getByRole('textbox', { name: 'amt' });
    fireEvent.change(el, { target: { value: '2*3' } });
    fireEvent.keyDown(el, { key: 'Enter', ctrlKey: true });
    expect(onFormKey).not.toHaveBeenCalled();
    expect((el as HTMLInputElement).value).toBe('6.00');
    fireEvent.keyDown(el, { key: 'Enter', ctrlKey: true });
    expect(onFormKey).toHaveBeenCalledTimes(1);
  });

  it('Escape abandons an expression', () => {
    render(<ControlledMoney initial="5" />);
    const el = screen.getByRole('textbox', { name: 'amt' }) as HTMLInputElement;
    fireEvent.change(el, { target: { value: '5+' } });
    fireEvent.keyDown(el, { key: 'Escape' });
    expect(el.value).toBe('5');
  });

  it('forwards refs', () => {
    let node: HTMLInputElement | null = null;
    render(<MoneyInput ref={(n) => { node = n; }} aria-label="r" value="" onChange={() => {}} />);
    expect(node).toBe(screen.getByLabelText('r'));
  });
});

describe('NumericInput', () => {
  function Controlled(props: Partial<React.ComponentProps<typeof NumericInput>> & { onValue?: (v: string) => void }) {
    const { onValue, ...rest } = props;
    const [v, setV] = useState('');
    return <NumericInput aria-label="n" {...rest} value={v} onChange={(n) => { onValue?.(n); setV(n); }} />;
  }

  it('keeps non-money precision', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onValue={onValue} decimals={4} />);
    await user.type(screen.getByLabelText('n'), '1/3{Enter}');
    expect(onValue).toHaveBeenLastCalledWith('0.3333');
  });

  it('enforces integer / min / max', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onValue={onValue} integer min={1} max={31} />);
    const el = screen.getByLabelText('n');
    await user.type(el, '10/4{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent(/whole number/i);
    await user.clear(el);
    await user.type(el, '10*4{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent(/at most 31/i);
    await user.clear(el);
    await user.type(el, '7*4{Enter}');
    expect(onValue).toHaveBeenLastCalledWith('28');
    expect(el).toHaveAttribute('inputmode', 'numeric');
  });

  it('allows negatives when min is not set', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onValue={onValue} />);
    await user.type(screen.getByLabelText('n'), '2-5{Enter}');
    expect(onValue).toHaveBeenLastCalledWith('-3');
  });

  it('passes plain typing straight through like a number input', async () => {
    const onValue = vi.fn();
    const user = userEvent.setup();
    render(<Controlled onValue={onValue} />);
    await user.type(screen.getByLabelText('n'), '12.5');
    expect(onValue.mock.calls.map((c) => c[0])).toEqual(['1', '12', '12.', '12.5']);
  });
});

describe('onBlur after commit', () => {
  it("a caller's onBlur-save sees the value the blur just committed", () => {
    const saved: string[] = [];
    function Saver() {
      const [v, setV] = useState('3');
      return <NumericInput aria-label="s" integer value={v} onChange={setV} onBlur={() => saved.push(v)} />;
    }
    render(<Saver />);
    const el = screen.getByLabelText('s');
    fireEvent.focus(el);
    fireEvent.change(el, { target: { value: '3*2' } });
    fireEvent.blur(el);
    expect(saved).toEqual(['6']);
  });
});

describe('onBlur with an invalid expression', () => {
  it("skips the caller's onBlur so a stale value is not saved", () => {
    const onBlur = vi.fn();
    render(<NumericInput aria-label="s" value="3" onChange={() => {}} onBlur={onBlur} />);
    const el = screen.getByLabelText('s');
    fireEvent.focus(el);
    fireEvent.change(el, { target: { value: '3*' } });
    fireEvent.blur(el);
    expect(onBlur).not.toHaveBeenCalled();
    expect(el).toHaveAttribute('aria-invalid', 'true');
  });
});
