import type { UIDataTypes, UIMessagePart, UITools, FileUIPart } from 'ai';
import { MODEL_REGEX, PROVIDER_REGEX } from '~/utils/constants';
import { Markdown } from './Markdown';
import { useStore } from '@nanostores/react';
import { profileStore } from '~/lib/stores/profile';

interface UserMessageProps {
  content: string;
  parts?: UIMessagePart<UIDataTypes, UITools>[];
}

function stripMetadata(content: string) {
  const artifactRegex = /<boltArtifact\s+[^>]*>[\s\S]*?<\/boltArtifact>/gm;
  return content.replace(MODEL_REGEX, '').replace(PROVIDER_REGEX, '').replace(artifactRegex, '');
}

function isImagePart(part: UIMessagePart<UIDataTypes, UITools>): part is FileUIPart {
  return part.type === 'file' && typeof part.mediaType === 'string' && part.mediaType.startsWith('image/');
}

export function UserMessage({ content, parts }: UserMessageProps) {
  const profile = useStore(profileStore);
  const textContent = stripMetadata(content);
  const imageParts = parts?.filter(isImagePart) ?? [];

  return (
    <div className="flex flex-col bg-accent-500/10 backdrop-blur-sm px-5 p-3.5 w-auto rounded-lg ml-auto">
      <div className="flex items-start gap-3.5 mb-3">
        <div className="flex items-center justify-center w-[32px] h-[32px] overflow-hidden bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-500 rounded-full shrink-0">
          {profile?.avatar ? (
            <img
              src={profile.avatar}
              alt={profile?.username || 'User'}
              className="w-full h-full object-cover"
              loading="eager"
              decoding="sync"
            />
          ) : (
            <div className="i-ph:user-fill text-lg" />
          )}
        </div>
        {imageParts.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {imageParts.map((item, index) => (
              <img
                key={`${item.url}-${index}`}
                src={item.url}
                alt={`Image ${index + 1}`}
                className="max-w-[160px] max-h-[160px] rounded-md object-contain border border-bolt-elements-borderColor"
              />
            ))}
          </div>
        )}
      </div>
      <Markdown html>{textContent}</Markdown>
    </div>
  );
}
