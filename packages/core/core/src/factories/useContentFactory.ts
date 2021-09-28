import { Ref, computed } from '@vue/composition-api';
import { RenderComponent, UseContent, Context, FactoryParams, UseContentErrors, PlatformApi } from '../types';
import { sharedRef, Logger, configureFactoryParams, setCacheTimestamp, isCacheValid } from '../utils';
import { PropOptions, VNode } from 'vue';

export interface UseContentFactoryParams<
  CONTENT,
  CONTENT_SEARCH_PARAMS,
  API extends PlatformApi = any
> extends FactoryParams<API> {
  search: (context: Context, params: CONTENT_SEARCH_PARAMS) => Promise<CONTENT>;
}

export function useContentFactory<CONTENT, CONTENT_SEARCH_PARAMS, API extends PlatformApi = any>(
  factoryParams: UseContentFactoryParams<CONTENT, CONTENT_SEARCH_PARAMS, API>
) {
  return function useContent(id: string, cacheTimeToLive: number): UseContent<CONTENT, CONTENT_SEARCH_PARAMS, API> {
    const content: Ref<CONTENT> = sharedRef([], `useContent-content-${id}`);
    const loading: Ref<boolean> = sharedRef(false, `useContent-loading-${id}`);
    const error: Ref<UseContentErrors> = sharedRef({
      search: null
    }, `useContent-error-${id}`);
    const cacheTimestamp: Ref<number> = setCacheTimestamp(`useContent-cache-${id}`);

    const _factoryParams = configureFactoryParams(
      factoryParams,
      { mainRef: content, alias: 'currentContent', loading, error }
    );

    const search = async(params: CONTENT_SEARCH_PARAMS, force = false): Promise<void> => {
      Logger.debug(`useContent/${id}/search`, params);
      if (isCacheValid(content, `useContent-cache-${id}`, cacheTimeToLive) && !force) return;
      try {
        loading.value = true;
        content.value = await _factoryParams.search(params);
        error.value.search = null;
        cacheTimestamp.value = Date.now();
      } catch (err) {
        error.value.search = err;
        Logger.error(`useContent/${id}/search`, err);
      } finally {
        loading.value = false;
      }
    };

    return {
      api: _factoryParams.api,
      search,
      content: computed(() => content.value),
      loading: computed(() => loading.value),
      error: computed(() => error.value),
      cacheTimestamp: computed(() => cacheTimestamp.value)
    };
  };
}

export declare type RenderContentFactoryParams<CONTENT = any> = {
  extractContent: (content) => CONTENT;
};

export function renderContentFactory(
  factoryParams: RenderContentFactoryParams<RenderComponent[]>
) {
  return {
    render: function render(createElement) {
      const components: VNode[] = [];
      // eslint-disable-next-line
      const self = this;
      const content = self.content;
      const resolvedContent: RenderComponent[] = factoryParams.extractContent(content);
      resolvedContent.map(function component(component: RenderComponent) {
        const { componentName, props } = component;
        components.push(createElement(componentName, { attrs: { name: componentName }, props }, self.$slots.default));
      });
      return createElement('div', components);
    },
    props: {
      content: {
        type: [Array, Object]
      } as PropOptions<[] | any>
    }
  };
}
