import { useLingui } from '@vendure/dashboard';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Bold, Italic, Heading3, List, ListOrdered } from 'lucide-react';

const extensions = [
    StarterKit.configure({ heading: { levels: [3] }, link: false }),
    Image,
];

export function ProductDetailsEditor({
    label,
    value,
    direction,
    assets,
    onChange,
}: {
    label: string;
    value: string;
    direction: 'ltr' | 'rtl';
    assets: { id: string; name: string; preview: string }[];
    onChange: (value: string) => void;
}) {
    const { _: t } = useLingui();
    const editor = useEditor({
        extensions,
        content: value,
        editorProps: {
            attributes: {
                role: 'textbox',
                'aria-label': label,
                'aria-multiline': 'true',
                dir: direction,
            },
        },
        onUpdate: ({ editor }) =>
            onChange(editor.isEmpty ? '' : editor.getHTML()),
    });
    const active = useEditorState({
        editor,
        selector: ({ editor }) => ({
            bold: editor?.isActive('bold'),
            italic: editor?.isActive('italic'),
            heading: editor?.isActive('heading'),
            bullets: editor?.isActive('bulletList'),
            numbering: editor?.isActive('orderedList'),
        }),
    });
    if (!editor) return null;
    const buttons = [
        {
            icon: Bold,
            name: t('shop.Bold'),
            active: active?.bold,
            run: () => editor.chain().focus().toggleBold().run(),
        },
        {
            icon: Italic,
            name: t('shop.Italic'),
            active: active?.italic,
            run: () => editor.chain().focus().toggleItalic().run(),
        },
        {
            icon: Heading3,
            name: t('shop.Heading'),
            active: active?.heading,
            run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        },
        {
            icon: List,
            name: t('shop.Bullets'),
            active: active?.bullets,
            run: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
            icon: ListOrdered,
            name: t('shop.Numbering'),
            active: active?.numbering,
            run: () => editor.chain().focus().toggleOrderedList().run(),
        },
    ];
    return (
        <div className="sv-details-editor">
            <h4>{label}</h4>
            <div className="sv-details-tools" role="group" aria-label={label}>
                {buttons.map(({ icon: Icon, name, active, run }) => (
                    <button
                        key={name}
                        title={name}
                        aria-label={name}
                        type="button"
                        aria-pressed={Boolean(active)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={run}
                    >
                        <Icon size={18} aria-hidden="true" focusable="false" />
                    </button>
                ))}
                {assets.length > 0 && (
                    <select
                        value=""
                        aria-label={t('shop.Insert product image')}
                        onChange={(e) => {
                            const asset = assets.find(
                                (a) => String(a.id) === e.target.value,
                            );
                            if (asset)
                                editor
                                    .chain()
                                    .focus()
                                    .setImage({
                                        src: asset.preview,
                                        alt: asset.name,
                                    })
                                    .run();
                        }}
                    >
                        <option value="">
                            {t('shop.Insert product image')}
                        </option>
                        {assets.map((a) => (
                            <option key={a.id} value={a.id}>
                                {a.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>
            <EditorContent editor={editor} />
        </div>
    );
}
