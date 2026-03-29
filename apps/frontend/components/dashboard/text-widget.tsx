import { BaseWidget } from './base-widget';

interface TextWidgetProps extends React.ComponentProps<typeof BaseWidget> {
  text: NonNullable<React.ReactNode>;
}

export function TextWidget({ text, isAiWidget, ...props }: TextWidgetProps) {
  return (
    <BaseWidget {...props} isAiWidget={isAiWidget}>
      <div className="text-sm leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_em]:italic [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-2 [&_p]:leading-5 [&_p:last-child]:mb-0 [&_strong]:font-semibold">
        {typeof text === 'string' ? <p>{text}</p> : text}
      </div>
    </BaseWidget>
  );
}
