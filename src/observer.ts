/**
 * @author Kuitos
 * @homepage https://github.com/kuitos/
 * @since 2018-05-22 16:39
 */
import { observe, runInAction } from 'mobx';
import Vue, { ComponentOptions } from 'vue';
import collectDataForVue from './collectData';

export type VueClass<V> = { new(...args: any[]): V & Vue } & typeof Vue;

function observer<VC extends VueClass<Vue>>(Component: VC | ComponentOptions<Vue>): VC;
function observer<VC extends VueClass<Vue>>(Component: VC | ComponentOptions<Vue>) {

	const name = (Component as any).name || (Component as any)._componentTag || (Component.constructor && Component.constructor.name) || '<component>';
	const originalOptions = typeof Component === 'object' ? Component : (Component as any).options;
	const dataDefinition = originalOptions.data;
	const propNames = originalOptions.props ? Object.keys(originalOptions.props) : [];

	const options = {
		// while parameter was component options, we could use it directly
		// otherwise we only use its data definition
		// we couldn't merge the options when Component was a VueClass, that will invoke the lifecycle twice after we called Component.extend
		...typeof Component === 'object' ? Component : {},
		name,
		data: (vm: any) => {
			// Holds any mobx models that are found by collectDataForVue
			const collectedMobxData: any[] = [];
			// Separate normal Vue data from mobx models
			const collectedVueData = collectDataForVue(vm, dataDefinition, collectedMobxData);
			let ignoreChange = false;
			// Find mobx model properties that match vue props and one-way bind them
			collectedMobxData.map(model => {
				observe(model, (change: any) => {
					if (ignoreChange) { return; }
					vm.$forceUpdate();
				});
				const watchProps = propNames.reduce((a: string[], p: string) => {
					a.push(p);
					return a;
				}, []);
				if (watchProps.length) {
					vm.$watch(() => {
						return watchProps.map(prop => vm[prop]);
					}, (values: any[]) => {
						runInAction(() => {
							ignoreChange = true;
							values.map((value, i) => model[watchProps[i]] = value);
							ignoreChange = false;
						});
					}, { immediate: true });
				}
			});
			return collectedVueData;
		},
	};

	if (!options.mixins) {
		options.mixins = [];
	}

	// remove the parent data definition to avoid reduplicate invocation
	delete originalOptions.data;

	const Super = (typeof Component === 'function' && Component.prototype instanceof Vue) ? Component : Vue;
	const ExtendedComponent = Super.extend(options);

	options.mixins.push({});

	Object.defineProperty(ExtendedComponent, 'name', {
		writable: false,
		value: name,
		enumerable: false,
		configurable: false,
	});

	return ExtendedComponent;
}

export { observer, observer as Observer };
