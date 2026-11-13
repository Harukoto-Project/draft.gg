import * as React from "react";

/** A flat dictionary: message key to translated text. Keys and English defaults are listed at /i18n/en.json. */
export type Messages = Record<string, string>;

type Values = Record<string, string | number>;
type I18nContextValue = { messages: Messages; locale: string | undefined };

const I18nContext = React.createContext<I18nContextValue>({ messages: {}, locale: undefined });

const subscribe = () => () => {};

/**
 * Translates every built-in string (aria-labels, placeholders, hidden text, default button labels) and sets the locale that
 * dates, numbers and sorting use. Put it once near the root. Anything you leave out stays in English.
 *
 *   <I18nProvider locale="ar" messages={{ "pagination.nextPage": "الصفحة التالية" }}>
 */
export function I18nProvider({
  messages = {},
  locale,
  children,
}: {
  messages?: Messages;
  locale?: string;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => ({ messages, locale }), [messages, locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * The locale for Intl formatting: the provider's, else `<html lang>`, else `fallback`.
 * Server render and the first client render use the provider or the fallback, so markup matches.
 */
export function useLocale(fallback = "en-US"): string {
  const { locale } = React.useContext(I18nContext);
  const documentLang = React.useSyncExternalStore(
    subscribe,
    () => document.documentElement.lang,
    () => "",
  );
  return locale ?? (documentLang || fallback);
}

function fill(template: string, values?: Values) {
  return values
    ? template.replace(/\{(\w+)\}/g, (all, name: string) =>
        name in values ? String(values[name]) : all,
      )
    : template;
}

/** English text, or its plural forms keyed by CLDR category (`other` is required). */
export type Fallback = string | ({ [K in Intl.LDMLPluralRule]?: string } & { other: string });

/** A string declared at module level (a status label in a lookup table); render it with `msg.of(message)`. */
export type Message = { key: string; text: string };
export const defineMessage = (key: string, text: string): Message => ({ key, text });

export type Msg = {
  (key: string, fallback: Fallback, values?: Values): string;
  /** Translate a message declared with defineMessage. */
  of: (message: Message, values?: Values) => string;
  /** Like `msg`, but `{name}` placeholders are filled with React nodes: msg.rich("k", "Press {key} to open", { key: <Kbd>K</Kbd> }). */
  rich: (key: string, fallback: string, nodes: Record<string, React.ReactNode>) => React.ReactNode;
};

/**
 * Returns `msg(key, english, values?)`. The text comes from the provider's messages, else the English default.
 * `{name}` placeholders are filled from `values`. With a numeric `count`, a plural form is used: the dictionary's
 * `key_one`, `key_few`, `key_many` or `key_other` (the CLDR categories of the locale), else the English forms you pass as
 * `{ one: "{count} item", other: "{count} items" }`.
 */
export function useMessages(): Msg {
  const { messages } = React.useContext(I18nContext);
  const locale = useLocale();
  return React.useMemo(() => {
    const msg = ((key: string, fallback: Fallback, values?: Values) => {
      let template: string | undefined;
      if (values && typeof values.count === "number") {
        try {
          const category = new Intl.PluralRules(locale).select(values.count);
          template =
            messages[`${key}_${category}`] ??
            (typeof fallback === "object" && !(key in messages)
              ? (fallback[category] ?? fallback.other)
              : undefined);
        } catch {
          // An invalid locale tag falls back to the plain key.
        }
      }
      template ??= messages[key] ?? (typeof fallback === "string" ? fallback : fallback.other);
      return fill(template, values);
    }) as Msg;
    msg.of = (message, values) => msg(message.key, message.text, values);
    msg.rich = (key, fallback, nodes) => {
      const template = messages[key] ?? fallback;
      return React.createElement(
        React.Fragment,
        null,
        ...template.split(/(\{\w+\})/).map((part, i) => {
          const name = /^\{(\w+)\}$/.exec(part)?.[1];
          return name && name in nodes
            ? React.createElement(React.Fragment, { key: i }, nodes[name])
            : part;
        }),
      );
    };
    return msg;
  }, [messages, locale]);
}
