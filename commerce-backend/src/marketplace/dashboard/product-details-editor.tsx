import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';

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
            name: 'Bold / عريض',
            active: active?.bold,
            run: () => editor.chain().focus().toggleBold().run(),
        },
        {
            name: 'Italic / مائل',
            active: active?.italic,
            run: () => editor.chain().focus().toggleItalic().run(),
        },
        {
            name: 'Heading / عنوان',
            active: active?.heading,
            run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        },
        {
            name: 'Bullets / نقاط',
            active: active?.bullets,
            run: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
            name: 'Numbering / ترقيم',
            active: active?.numbering,
            run: () => editor.chain().focus().toggleOrderedList().run(),
        },
    ];
    return (
        <div className="sv-details-editor">
            <h4>{label}</h4>
            <div className="sv-details-tools" role="group" aria-label={label}>
                {buttons.map((button) => (
                    <button
                        key={button.name}
                        type="button"
                        aria-pressed={Boolean(button.active)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={button.run}
                    >
                        {button.name}
                    </button>
                ))}
                {assets.length > 0 && (
                    <select
                        value=""
                        aria-label="Insert product image / إدراج صورة المنتج"
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
                            Insert product image / إدراج صورة المنتج
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
