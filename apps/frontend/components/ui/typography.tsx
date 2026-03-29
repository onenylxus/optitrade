// This component is not directly from shadcn/ui, as described in https://ui.shadcn.com/docs/components/radix/typography:
//
// We do not ship any typography styles by default. This page is an example of how you can use utility classes to style your text.

import * as React from 'react';
import { forwardRef, JSX } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

type TypographyVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'p'
  | 'blockquote'
  | 'table'
  | 'list'
  | 'inlineCode'
  | 'lead'
  | 'large'
  | 'small'
  | 'muted';

export const typographyVariants = cva('', {
  variants: {
    variant: {
      h1: 'scroll-m-20 text-center text-4xl font-extrabold tracking-tight text-balance',
      h2: 'scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0',
      h3: 'scroll-m-20 text-2xl font-semibold tracking-tight',
      h4: 'scroll-m-20 text-xl font-semibold tracking-tight',
      p: 'leading-7 [&:not(:first-child)]:mt-6',
      blockquote: 'mt-6 border-l-2 pl-6 italic',
      table: 'my-6 w-full overflow-y-auto',
      list: 'my-6 ml-6 list-disc [&>li]:mt-2',
      inlineCode:
        'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold',
      lead: 'text-xl text-muted-foreground',
      large: 'text-lg font-semibold',
      small: 'text-sm leading-none font-medium',
      muted: 'text-sm text-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'p',
  },
});

const getComponentFromVariant = (variant: TypographyVariant): keyof JSX.IntrinsicElements => {
  switch (variant) {
    case 'h1':
      return 'h1';
    case 'h2':
      return 'h2';
    case 'h3':
      return 'h3';
    case 'h4':
      return 'h4';
    case 'p':
      return 'p';
    case 'blockquote':
      return 'blockquote';
    case 'table':
      return 'div';
    case 'list':
      return 'ul';
    case 'inlineCode':
      return 'code';
    case 'lead':
      return 'p';
    case 'large':
      return 'div';
    case 'small':
      return 'small';
    case 'muted':
      return 'p';
    default:
      return 'p';
  }
};

type TypographyProps = {
  variant?: TypographyVariant;
  component?: keyof JSX.IntrinsicElements;
  className?: string;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof typographyVariants>;

export const Typography = forwardRef<HTMLElement, TypographyProps>(
  ({ variant = 'p', component, className, children, ...props }, ref) => {
    const tag = component ?? getComponentFromVariant(variant);
    return React.createElement(
      tag,
      {
        ...props,
        ref,
        className: cn(typographyVariants({ variant }), className),
      },
      children,
    );
  },
);

Typography.displayName = 'Typography';
