/**
 * @author Kuitos
 * @homepage https://github.com/kuitos/
 * @since 2018-05-22 16:39
 */
import { Reaction, comparer, runInAction } from 'mobx';
import Vue, { ComponentOptions } from 'vue';
import collectDataForVue from './collectData';

export type VueClass<V> = { new(...args: any[]): V & Vue } & typeof Vue;

// @formatter:off
// tslint:disable-next-line
const noop = () => {};
// @formatter:on
function observer<VC extends VueClass<Vue>>(Component: VC | ComponentOptions<Vue>): VC;
function observer<VC extends VueClass<Vue>>(Component: VC | ComponentOptions<Vue>) {

	const name = (Component as any).name || (Component as any)._componentTag || (Component.constructor && Component.constructor.name) || '<component>';

	const originalOptions = typeof Component === 'object' ? Component : (Component as any).options;
	const dataDefinition = originalOptions.data;
	const propNames = originalOptions.props ? Object.keys(originalOptions.props) : [];

	type AugmentedVue = Vue & {__mobxPropWatchers__: Array<() => void>};

	const options = {
		// while parameter was component options, we could use it directly
		// otherwise we only use its data definition
		// we couldn't merge the options when Component was a VueClass, that will invoke the lifecycle twice after we called Component.extend
		...typeof Component === 'object' ? Component : {},
		name,
		data: (vm: AugmentedVue) => {
			// Holds any mobx models that are found by collectDataForVue
			const collectedMobxData: any[] = [];
			// Separate normal Vue data from mobx models
			const collectedVueData = collectDataForVue(vm, dataDefinition, collectedMobxData);
			// Store the watcher removal fns for later cleanup
			vm.__mobxPropWatchers__ = [];
			// Find mobx model properties that match vue props and one-way bind them
			collectedMobxData.map(model => {
				for (const prop of propNames) {
					if (prop in model) {
						// Watch props for changes and set matching values in the mobx model
						vm.__mobxPropWatchers__.push(vm.$watch(prop, value => runInAction(() => model[prop] = value), { immediate: true }));
					}
				}
			});
			return collectedVueData;
		},
	};

	if (!options.mixins) {
		options.mixins = [];
	}

	// Clean up any prop watchers
	options.mixins.push({
		destroyed() {
			const vm = this as AugmentedVue;
			vm.__mobxPropWatchers__.map(fn => fn());
		},
	});

	// remove the parent data definition to avoid reduplicate invocation
	delete originalOptions.data;

	const Super = (typeof Component === 'function' && Component.prototype instanceof Vue) ? Component : Vue;
	const ExtendedComponent = Super.extend(options);

	let disposer = noop;

	const { $mount, $destroy } = ExtendedComponent.prototype;

	ExtendedComponent.prototype.$mount = function (this: any, ...args: any[]) {

		let mounted = false;

		let nativeRenderOfVue: any;
		const reactiveRender = () => {
			reaction.track(() => {
				if (!mounted) {
					$mount.apply(this, args);
					mounted = true;
					nativeRenderOfVue = this._watcher.getter;
					// rewrite the native render method of vue with our reactive tracker render
					// thus if component updated by vue watcher, we could re track and collect dependencies by mobx
					this._watcher.getter = reactiveRender;
				} else {
					nativeRenderOfVue.call(this, this);
				}
			});

			return this;
		};

		const reaction = new Reaction(`${name}.render()`, reactiveRender);

		disposer = reaction.getDisposer();

		return reactiveRender();
	};

	ExtendedComponent.prototype.$destroy = function (this: Vue) {
		disposer();
		$destroy.apply(this);
	};

	Object.defineProperty(ExtendedComponent, 'name', {
		writable: false,
		value: name,
		enumerable: false,
		configurable: false,
	});

	return ExtendedComponent;
}

export {
	observer,
	observer as Observer,
};
