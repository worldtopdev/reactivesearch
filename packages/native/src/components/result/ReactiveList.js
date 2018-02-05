import React, { Component } from 'react';
import { View } from 'react-native';
import { Text, Spinner, Button, Icon } from 'native-base';

import {
	addComponent,
	removeComponent,
	setStreaming,
	watchComponent,
	setQueryOptions,
	updateQuery,
	loadMore,
} from '@appbaseio/reactivecore/lib/actions';
import {
	isEqual,
	getQueryOptions,
	pushToAndClause,
	checkPropChange,
	checkSomePropChange,
	parseHits,
} from '@appbaseio/reactivecore/lib/utils/helper';
import types from '@appbaseio/reactivecore/lib/utils/types';

import List from './addons/List';
import withTheme from '../../theme/withTheme';
import { connect, getInnerStyle } from '../../utils';

class ReactiveList extends Component {
	constructor(props) {
		super(props);

		this.state = {
			from: 0,
			isLoading: false,
			totalPages: 0,
			currentPage: 0,
		};
		this.listRef = null;
		this.internalComponent = `${props.componentId}__internal`;
	}

	componentDidMount() {
		this.props.addComponent(this.internalComponent);
		this.props.addComponent(this.props.componentId);

		if (this.props.stream) {
			this.props.setStreaming(this.props.componentId, true);
		}

		const options = getQueryOptions(this.props);
		if (this.props.sortBy) {
			options.sort = [{
				[this.props.dataField]: {
					order: this.props.sortBy,
				},
			}];
		}

		// Override sort query with defaultQuery's sort if defined
		this.defaultQuery = null;
		if (this.props.defaultQuery) {
			this.defaultQuery = this.props.defaultQuery();
			if (this.defaultQuery.sort) {
				options.sort = this.defaultQuery.sort;
			}
		}

		this.props.setQueryOptions(
			this.props.componentId,
			options,
			!(this.defaultQuery && this.defaultQuery.query),
		);
		this.setReact(this.props);

		if (this.defaultQuery) {
			const { sort, ...query } = this.defaultQuery;
			this.props.updateQuery({
				componentId: this.internalComponent,
				query,
			});
		} else {
			this.props.updateQuery({
				componentId: this.internalComponent,
				query: null,
			});
		}
	}

	componentWillReceiveProps(nextProps) {
		checkSomePropChange(
			this.props,
			nextProps,
			['sortBy', 'size', 'dataField'],
			() => {
				const options = getQueryOptions(nextProps);
				if (nextProps.sortBy) {
					options.sort = [{
						[nextProps.dataField]: {
							order: nextProps.sortBy,
						},
					}];
				}
				this.props.setQueryOptions(this.props.componentId, options, true);
			},
		);

		if (
			nextProps.defaultQuery
			&& !isEqual(nextProps.defaultQuery(), this.defaultQuery)
		) {
			const options = getQueryOptions(nextProps);
			this.defaultQuery = nextProps.defaultQuery();

			const { sort, ...query } = this.defaultQuery;

			if (sort) {
				options.sort = this.defaultQuery.sort;
				nextProps.setQueryOptions(nextProps.componentId, options, !query);
			}

			this.props.updateQuery({
				componentId: this.internalComponent,
				query,
			});
		}

		if (this.props.stream !== nextProps.stream) {
			this.props.setStreaming(nextProps.componentId, nextProps.stream);
		}

		checkPropChange(
			this.props.react,
			nextProps.react,
			() => this.setReact(nextProps),
		);

		if (
			!nextProps.pagination
			&& this.props.hits
			&& nextProps.hits
			&& (
				this.props.hits.length < nextProps.hits.length
				|| nextProps.hits.length === nextProps.total
			)
		) {
			this.setState({
				isLoading: false,
			});
		}

		if (
			!nextProps.pagination
			&& nextProps.hits
			&& this.props.hits
			&& nextProps.hits.length < this.props.hits.length
		) {
			if (this.listRef) {
				this.listRef.scrollToOffset({ x: 0, y: 0, animated: false });
			}
			this.setState({
				from: 0,
				isLoading: false,
			});
		}

		if (nextProps.pagination && nextProps.total !== this.props.total) {
			this.setState({
				totalPages: nextProps.total / nextProps.size,
				currentPage: 0,
			});
		}
	}

	componentWillUnmount() {
		this.props.removeComponent(this.props.componentId);
	}

	setReact = (props) => {
		const { react } = props;
		if (react) {
			const newReact = pushToAndClause(react, this.internalComponent);
			props.watchComponent(props.componentId, newReact);
		} else {
			props.watchComponent(props.componentId, { and: this.internalComponent });
		}
	};

	loadMore = () => {
		if (
			this.props.hits
			&& !this.props.pagination
			&& this.props.total !== this.props.hits.length
		) {
			const value = this.state.from + this.props.size;
			const options = getQueryOptions(this.props);

			this.setState({
				from: value,
				isLoading: true,
			});
			this.props.loadMore(this.props.componentId, {
				...options,
				from: value,
			}, true);
		} else if (this.state.isLoading) {
			this.setState({
				isLoading: false,
			});
		}
	};

	setPage = (page) => {
		const value = this.props.size * page;
		const options = getQueryOptions(this.props);
		this.setState({
			from: value,
			isLoading: true,
			currentPage: page,
		});
		this.props.loadMore(this.props.componentId, {
			...options,
			from: value,
		}, false);
	};

	prevPage = () => {
		if (this.state.currentPage) {
			this.setPage(this.state.currentPage - 1);
		}
	};

	nextPage = () => {
		if (this.state.currentPage < this.state.totalPages - 1) {
			this.setPage(this.state.currentPage + 1);
		}
	};

	getStart = () => {
		const midValue = parseInt(this.props.pages / 2, 10);
		const start = this.state.currentPage - midValue;
		return start > 1 ? start : 2;
	};

	renderPagination = () => {
		const start = this.getStart();
		const pages = [];

		for (let i = start; i < (start + this.props.pages) - 1; i += 1) {
			const activeStyles = {
				button: {},
				text: {},
			};

			if (this.state.currentPage === i - 1) {
				activeStyles.button = {
					backgroundColor: this.props.theming.primaryColor,
				};
				activeStyles.text = {
					color: this.props.theming.primaryTextColor,
				};
			}

			const pageBtn = (
				<Button
					key={i - 1}
					onPress={() => this.setPage(i - 1)}
					light={this.state.currentPage !== i - 1}
					style={{
						...activeStyles.button,
						...getInnerStyle(this.props.innerStyle, 'button'),
					}}
				>
					<Text
						style={{
							...activeStyles.text,
							...getInnerStyle(this.props.innerStyle, 'label'),
						}}
					>
						{i}
					</Text>
				</Button>
			);
			if (i <= this.state.totalPages + 1) {
				pages.push(pageBtn);
			}
		}

		if (!this.state.totalPages) {
			return null;
		}

		const primaryStyles = {
			button: {},
			text: {},
		};

		if (this.state.currentPage === 0) {
			primaryStyles.button = {
				backgroundColor: this.props.theming.primaryColor,
			};
			primaryStyles.text = {
				color: this.props.theming.primaryTextColor,
			};
		}

		return (
			<View
				style={{
					flexDirection: 'row',
					justifyContent: 'space-between',
					marginTop: 20,
					marginBottom: 20,
				}}
			>
				<Button
					light={this.state.currentPage !== 0}
					disabled={this.state.currentPage === 0}
					onPress={this.prevPage}
					style={getInnerStyle(this.props.innerStyle, 'button')}
				>
					<Icon
						name="ios-arrow-back"
						style={getInnerStyle(this.props.innerStyle, 'icon')}
					/>
				</Button>
				{
					<Button
						onPress={() => this.setPage(0)}
						light={this.state.currentPage !== 0}
						style={{
							...primaryStyles.button,
							...getInnerStyle(this.props.innerStyle, 'button'),
						}}
					>
						<Text
							style={{
								...primaryStyles.text,
								...getInnerStyle(this.props.innerStyle, 'label'),
							}}
						>
							1
						</Text>
					</Button>
				}
				{
					this.state.currentPage >= this.props.pages
						? (
							<View
								style={{
									height: 45,
									display: 'flex',
									justifyContent: 'center',
									alignItems: 'center',
								}}
							>
								<Text style={getInnerStyle(this.props.innerStyle, 'label')}>...</Text>
							</View>
						)
						: null
				}
				{
					pages
				}
				<Button
					onPress={this.nextPage}
					light={this.state.currentPage < this.state.totalPages - 1}
					disabled={this.state.currentPage >= this.state.totalPages - 1}
					style={getInnerStyle(this.props.innerStyle, 'button')}
				>
					<Icon
						name="ios-arrow-forward"
						style={getInnerStyle(this.props.innerStyle, 'icon')}
					/>
				</Button>
			</View>
		);
	};

	setRef = (node) => {
		this.listRef = node;
	};

	renderResultStats = () => {
		if (this.props.onResultStats && this.props.total) {
			return this.props.onResultStats(this.props.total, this.props.time);
		} else if (this.props.total) {
			return (
				<Text>
					{this.props.total} results found in {this.props.time}ms
				</Text>
			);
		}
		return null;
	};

	render() {
		const results = parseHits(this.props.hits) || [];
		const streamResults = parseHits(this.props.streamHits) || [];
		let filteredResults = results;

		if (streamResults.length) {
			const ids = streamResults.map(item => item._id);
			filteredResults = filteredResults.filter(item => !ids.includes(item._id));
		}

		return (
			<View style={this.props.style}>
				{
					this.props.showResultStats
						? this.renderResultStats()
						: null
				}
				{
					this.props.pagination && this.props.paginationAt === 'top'
						? this.renderPagination()
						: null
				}
				{
					this.props.onAllData
						? (
							this.props.onAllData(
								results,
								streamResults,
								this.loadMore,
							)
						)
						: (
							<List
								setRef={this.setRef}
								data={[...streamResults, ...filteredResults]}
								onData={this.props.onData}
								onEndReached={this.loadMore}
							/>
						)
				}
				{
					this.state.isLoading && !this.props.pagination
						? (<View><Spinner /></View>)
						: null
				}
				{
					this.props.pagination && this.props.paginationAt === 'bottom'
						? this.renderPagination()
						: null
				}
			</View>
		);
	}
}

ReactiveList.propTypes = {
	addComponent: types.funcRequired,
	componentId: types.stringRequired,
	sortBy: types.sortBy,
	dataField: types.stringRequired,
	setQueryOptions: types.funcRequired,
	defaultQuery: types.func,
	updateQuery: types.funcRequired,
	size: types.number,
	react: types.react,
	pagination: types.bool,
	paginationAt: types.paginationAt,
	hits: types.hits,
	streamHits: types.hits,
	stream: types.bool,
	setStreaming: types.func,
	total: types.number,
	removeComponent: types.funcRequired,
	loadMore: types.funcRequired,
	pages: types.number,
	onAllData: types.func,
	onData: types.func,
	time: types.number,
	showResultStats: types.bool,
	onResultStats: types.func,
	isLoading: types.bool,
	style: types.style,
	theming: types.style,
	innerStyle: types.style,
};

ReactiveList.defaultProps = {
	pagination: false,
	pages: 5,
	size: 10,
};

ReactiveList.defaultProps = {
	pagination: false,
	paginationAt: 'bottom',
	pages: 5,
	size: 10,
	showResultStats: true,
	style: {},
};

const mapStateToProps = (state, props) => ({
	hits: state.hits[props.componentId] && state.hits[props.componentId].hits,
	streamHits: state.streamHits[props.componentId] || [],
	total: state.hits[props.componentId] && state.hits[props.componentId].total,
	time: (state.hits[props.componentId] && state.hits[props.componentId].time) || 0,
	isLoading: state.isLoading[props.componentId] || false,
	url: state.config.url,
});

const mapDispatchtoProps = dispatch => ({
	addComponent: component => dispatch(addComponent(component)),
	removeComponent: component => dispatch(removeComponent(component)),
	setStreaming: (component, stream) => dispatch(setStreaming(component, stream)),
	watchComponent: (component, react) => dispatch(watchComponent(component, react)),
	setQueryOptions: (component, props, execute) =>
		dispatch(setQueryOptions(component, props, execute)),
	updateQuery: updateQueryObject => dispatch(updateQuery(updateQueryObject)),
	loadMore: (component, options, append) => dispatch(loadMore(component, options, append)),
});

export default connect(mapStateToProps, mapDispatchtoProps)(withTheme(ReactiveList));