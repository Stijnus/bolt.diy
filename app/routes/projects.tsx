import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { Header } from '~/components/header/Header';
import { ClientOnly } from 'remix-utils/client-only';
import { Menu } from '~/components/sidebar/Menu.client';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ProjectDashboard } from '~/components/projects/ProjectDashboard';
import { cssTransition, ToastContainer } from 'react-toastify';

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

export async function loader(args: LoaderFunctionArgs) {
  return json({ id: args.params.id });
}

export default function Projects() {
  return (
    <div className="flex flex-col h-full w-full">
      <Header />
      <Tooltip.Provider delayDuration={200}>
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <ClientOnly>{() => <ProjectDashboard />}</ClientOnly>
        <ToastContainer
          closeButton={({ closeToast }: any) => {
            return (
              <button className="Toastify__close-button" onClick={closeToast}>
                <div className="i-ph:x text-lg" />
              </button>
            );
          }}
          icon={({ type }: any) => {
            /**
             * @todo Handle more types if we need them. This may require extra color palettes.
             */
            switch (type) {
              case 'success': {
                return <div className="i-ph:check-bold text-bolt-elements-icon-success text-2xl" />;
              }
              case 'error': {
                return <div className="i-ph:warning-circle-bold text-bolt-elements-icon-error text-2xl" />;
              }
            }

            return undefined;
          }}
          position="bottom-right"
          pauseOnFocusLoss
          transition={toastAnimation}
        />
      </Tooltip.Provider>
    </div>
  );
}
