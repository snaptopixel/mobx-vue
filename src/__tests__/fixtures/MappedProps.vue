<template>
	<section>
		<p ref="age" v-text="model.age"></p>
		<p ref="computed-age" v-text="model.computedAge"></p>
		<button @click="model.setAge"></button>
	</section>
</template>

<script lang="ts">

	import { action, computed, observable } from 'mobx';
	import Vue from 'vue';
	import Component from 'vue-class-component';
	import { Observer } from '../../index';

	class Model {
		@observable
		age = 10;

		@observable
		ageIncrement = 1;

		@computed
		get computedAge() {
			return this.age + this.ageIncrement;
		}

		@action.bound
		setAge() {
			this.age++;
		}
	}

	@Observer
	@Component({
		props: {
			ageIncrement: Number,
			age: Number,
		}
	})
	export default class MappedProps extends Vue {
		model = new Model();
	}
</script>
