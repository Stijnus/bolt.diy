import { useParams } from '@remix-run/react';
import { classNames } from '~/utils/classNames';
import { type ChatHistoryItem } from '~/lib/persistence';
import WithTooltip from '~/components/ui/Tooltip';
import { useEditChatDescription } from '~/lib/hooks';
import { forwardRef, type ForwardedRef, useCallback } from 'react';
import { Checkbox } from '~/components/ui/Checkbox';

interface HistoryItemProps {
  item: ChatHistoryItem;
  onDelete?: (event: React.UIEvent) => void;
  onDuplicate?: (id: string) => void;
  exportChat: (id?: string) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string) => void;
}

export function HistoryItem({
  item,
  onDelete,
  onDuplicate,
  exportChat,
  selectionMode = false,
  isSelected = false,
  onToggleSelection,
}: HistoryItemProps) {
  const { id: urlId } = useParams();
  const isActiveChat = urlId === item.urlId;

  const { editing, handleChange, handleBlur, handleSubmit, handleKeyDown, currentDescription, toggleEditMode } =
    useEditChatDescription({
      initialDescription: item.description,
      customChatId: item.id,
      syncWithGlobalStore: isActiveChat,
    });

  const handleItemClick = useCallback(
    (e: React.MouseEvent) => {
      if (selectionMode) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Item clicked in selection mode:', item.id);
        onToggleSelection?.(item.id);
      }
    },
    [selectionMode, item.id, onToggleSelection],
  );

  const handleCheckboxChange = useCallback(() => {
    console.log('Checkbox changed for item:', item.id);
    onToggleSelection?.(item.id);
  }, [item.id, onToggleSelection]);

  const handleDeleteClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      event.preventDefault();
      event.stopPropagation();
      console.log('Delete button clicked for item:', item.id);

      if (onDelete) {
        onDelete(event as unknown as React.UIEvent);
      }
    },
    [onDelete, item.id],
  );

  return (
    <div
      className={classNames(
        'group relative rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50/80 dark:hover:bg-gray-800/30 overflow-hidden flex justify-between items-center px-3 py-2 transition-colors border border-transparent',
        {
          'text-gray-900 dark:text-white bg-purple-50/60 dark:bg-purple-500/10 border-purple-300/70 dark:border-purple-500/30 shadow-[0_0_0_1px_rgba(168,85,247,0.25)]':
            isActiveChat,
        },
        { 'cursor-pointer': selectionMode },
      )}
      onClick={selectionMode ? handleItemClick : undefined}
    >
      <span
        aria-hidden
        className={classNames(
          'pointer-events-none absolute left-1 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-purple-500 transition-opacity duration-150',
          {
            'opacity-100': isActiveChat,
            'opacity-0 group-hover:opacity-60': !isActiveChat,
          },
        )}
      />
      {selectionMode && (
        <div className="flex items-center mr-2" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            id={`select-${item.id}`}
            checked={isSelected}
            onCheckedChange={handleCheckboxChange}
            className="h-4 w-4"
          />
        </div>
      )}

      {editing ? (
        <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
          <input
            type="text"
            className="flex-1 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-md px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-800 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
            autoFocus
            value={currentDescription}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
          <button
            type="submit"
            className="i-ph:check h-4 w-4 text-gray-500 hover:text-purple-500 transition-colors"
            onMouseDown={handleSubmit}
          />
        </form>
      ) : (
        <a
          href={`/chat/${item.urlId}`}
          className="flex w-full relative truncate block"
          aria-current={isActiveChat ? 'page' : undefined}
          onClick={selectionMode ? handleItemClick : undefined}
        >
          <WithTooltip tooltip={currentDescription}>
            <span
              className={classNames('truncate pr-24', {
                'font-medium text-purple-700 dark:text-purple-200': isActiveChat,
              })}
            >
              {currentDescription}
            </span>
          </WithTooltip>
          <div
            className={classNames(
              'absolute right-0 top-0 bottom-0 flex items-center bg-transparent px-2 transition-colors',
            )}
          >
            <div className="flex items-center gap-2.5 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
              <ChatActionButton
                toolTipContent="Export"
                icon="i-ph:download-simple h-4 w-4"
                onClick={(event) => {
                  event.preventDefault();
                  exportChat(item.id);
                }}
              />
              {onDuplicate && (
                <ChatActionButton
                  toolTipContent="Duplicate"
                  icon="i-ph:copy h-4 w-4"
                  onClick={(event) => {
                    event.preventDefault();
                    onDuplicate?.(item.id);
                  }}
                />
              )}
              <ChatActionButton
                toolTipContent="Rename"
                icon="i-ph:pencil-fill h-4 w-4"
                onClick={(event) => {
                  event.preventDefault();
                  toggleEditMode();
                }}
              />
              <ChatActionButton
                toolTipContent="Delete"
                icon="i-ph:trash h-4 w-4"
                className="hover:text-red-500 dark:hover:text-red-400"
                onClick={handleDeleteClick}
              />
            </div>
          </div>
        </a>
      )}
    </div>
  );
}

const ChatActionButton = forwardRef(
  (
    {
      toolTipContent,
      icon,
      className,
      onClick,
    }: {
      toolTipContent: string;
      icon: string;
      className?: string;
      onClick: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
      btnTitle?: string;
    },
    ref: ForwardedRef<HTMLButtonElement>,
  ) => {
    return (
      <WithTooltip tooltip={toolTipContent} position="bottom" sideOffset={4}>
        <button
          ref={ref}
          type="button"
          className={`text-gray-400 dark:text-gray-500 hover:text-purple-500 dark:hover:text-purple-400 transition-colors ${icon} ${className ? className : ''}`}
          onClick={onClick}
        />
      </WithTooltip>
    );
  },
);
