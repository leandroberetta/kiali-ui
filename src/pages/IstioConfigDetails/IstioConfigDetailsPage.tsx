import * as React from 'react';
import { Prompt, RouteComponentProps } from 'react-router-dom';
import {
  aceOptions,
  compareResourceVersion,
  IstioConfigDetails,
  IstioConfigId,
  safeDumpOptions
} from '../../types/IstioConfigDetails';
import * as AlertUtils from '../../utils/AlertUtils';
import * as API from '../../services/Api';
import AceEditor from 'react-ace';
import 'ace-builds/src-noconflict/mode-yaml';
import 'ace-builds/src-noconflict/theme-eclipse';
import {
  HelpMessage,
  ObjectReference,
  ObjectValidation,
  ServiceReference,
  ValidationMessage,
  WorkloadReference
} from '../../types/IstioObjects';
import {
  AceValidations,
  jsYaml,
  parseHelpAnnotations,
  parseKialiValidations,
  parseLine,
  parseYamlValidations
} from '../../types/AceValidations';
import IstioActionDropdown from '../../components/IstioActions/IstioActionsDropdown';
import { RenderComponentScroll, RenderHeader } from '../../components/Nav/Page';
import './IstioConfigDetailsPage.css';
import { default as IstioActionButtonsContainer } from '../../components/IstioActions/IstioActionsButtons';
import history from '../../app/History';
import { Paths } from '../../config';
import { MessageType } from '../../types/MessageCenter';
import { getIstioObject, mergeJsonPatch } from '../../utils/IstioConfigUtils';
import { style } from 'typestyle';
import ParameterizedTabs, { activeTab } from '../../components/Tab/Tabs';
import {
  Drawer,
  DrawerActions,
  DrawerCloseButton,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerPanelContent,
  Tab
} from '@patternfly/react-core';
import { dicIstioType } from '../../types/IstioConfigList';
import { showInMessageCenter } from '../../utils/IstioValidationUtils';
import { AxiosError } from 'axios';
import RefreshButtonContainer from '../../components/Refresh/RefreshButton';
import IstioConfigOverview from './IstioObjectDetails/IstioConfigOverview';
import { Annotation } from 'react-ace/types';

// Enables the search box for the ACEeditor
require('ace-builds/src-noconflict/ext-searchbox');

const rightToolbarStyle = style({
  zIndex: 500
});

const editorDrawer = style({
  margin: '0'
});

// TODO perhaps we may want to enable automatic refresh in all list/details pages
const TIMER_REFRESH = 5000;

interface IstioConfigDetailsState {
  istioObjectDetails?: IstioConfigDetails;
  istioValidations?: ObjectValidation;
  originalIstioObjectDetails?: IstioConfigDetails;
  originalIstioValidations?: ObjectValidation;
  isModified: boolean;
  isRemoved: boolean;
  yamlModified?: string;
  yamlValidations?: AceValidations;
  currentTab: string;
  isExpanded: boolean;
  selectedEditorLine?: string;
}

const tabName = 'list';
const paramToTab: { [key: string]: number } = {
  yaml: 0
};

class IstioConfigDetailsPage extends React.Component<RouteComponentProps<IstioConfigId>, IstioConfigDetailsState> {
  aceEditorRef: React.RefObject<AceEditor>;
  drawerRef: React.RefObject<IstioConfigDetailsPage>;
  promptTo: string;
  timerId: number;

  constructor(props: RouteComponentProps<IstioConfigId>) {
    super(props);
    this.state = {
      isModified: false,
      isRemoved: false,
      currentTab: activeTab(tabName, this.defaultTab()),
      isExpanded: false
    };
    this.aceEditorRef = React.createRef();
    this.drawerRef = React.createRef();
    this.promptTo = '';
    this.timerId = -1;
  }

  defaultTab() {
    return 'yaml';
  }

  objectTitle() {
    let title: string = '';
    if (this.state.istioObjectDetails) {
      const objectType = dicIstioType[this.props.match.params.objectType];
      const methodName = objectType.charAt(0).toLowerCase() + objectType.slice(1);
      const object = this.state.istioObjectDetails[methodName];
      if (object) {
        title = object.metadata.name;
      }
    }
    return title;
  }

  fetchIstioObjectDetails = () => {
    this.fetchIstioObjectDetailsFromProps(this.props.match.params);
  };

  newIstioObjectPromise = (props: IstioConfigId, validate: boolean) => {
    return API.getIstioConfigDetail(props.namespace, props.objectType, props.object, validate);
  };

  fetchIstioObjectDetailsFromProps = (props: IstioConfigId) => {
    const promiseConfigDetails = this.newIstioObjectPromise(props, true);

    window.clearInterval(this.timerId);
    this.timerId = window.setInterval(() => {
      const timerPromise = this.newIstioObjectPromise(props, false);
      timerPromise
        .then(resultConfigDetails => {
          if (resultConfigDetails.data && this.state.originalIstioObjectDetails) {
            const [changed, type, newResourceVersion] = compareResourceVersion(
              this.state.originalIstioObjectDetails,
              resultConfigDetails.data
            );
            if (changed) {
              AlertUtils.addWarning(
                type +
                  ':' +
                  props.object +
                  ' has a newer version (' +
                  newResourceVersion +
                  '). Reload to see a new version.'
              );
            }
          }
        })
        .catch(error => {
          this.setState({
            isRemoved: true
          });
          AlertUtils.addError(
            `Could not fetch ${props.objectType}: ${props.object} in namespace: ${props.namespace}. Has it been removed?`,
            error
          );
        });
    }, TIMER_REFRESH);

    // Note that adapters/templates are not supported yet for validations
    promiseConfigDetails
      .then(resultConfigDetails => {
        this.setState(
          {
            istioObjectDetails: resultConfigDetails.data,
            originalIstioObjectDetails: resultConfigDetails.data,
            istioValidations: resultConfigDetails.data.validation,
            originalIstioValidations: resultConfigDetails.data.validation,
            isModified: false,
            isExpanded: this.isExpanded(resultConfigDetails.data),
            yamlModified: '',
            currentTab: activeTab(tabName, this.defaultTab())
          },
          () => this.resizeEditor()
        );
      })
      .catch(error => {
        this.setState({
          isRemoved: true
        });
        AlertUtils.addError(
          `Could not fetch Istio object type [${props.objectType}] name [${props.object}] in namespace [${props.namespace}].`,
          error
        );
      });
  };

  componentDidMount() {
    this.fetchIstioObjectDetails();
  }

  componentDidUpdate(prevProps: RouteComponentProps<IstioConfigId>, prevState: IstioConfigDetailsState): void {
    // This will ask confirmation if we want to leave page on pending changes without save
    if (this.state.isModified) {
      window.onbeforeunload = () => true;
    } else {
      window.onbeforeunload = null;
    }
    // This will reset the flag to prevent ask multiple times the confirmation to leave with unsaved changed
    this.promptTo = '';
    // Hack to force redisplay of annotations after update
    // See https://github.com/securingsincity/react-ace/issues/300
    if (this.aceEditorRef.current) {
      const editor = this.aceEditorRef.current!['editor'];

      // tslint:disable-next-line
      editor.onChangeAnnotation();

      // Fold status and/or managedFields fields
      const { startRow, endRow } = this.getFoldRanges(this.fetchYaml());
      if (!this.state.isModified) {
        editor.session.foldAll(startRow, endRow, 0);
      }
    }

    const active = activeTab(tabName, this.defaultTab());
    if (this.state.currentTab !== active) {
      this.setState({ currentTab: active });
    }

    if (!this.propsMatch(prevProps)) {
      this.fetchIstioObjectDetailsFromProps(this.props.match.params);
    }

    if (this.state.istioValidations && this.state.istioValidations !== prevState.istioValidations) {
      showInMessageCenter(this.state.istioValidations);
    }
  }

  propsMatch(prevProps: RouteComponentProps<IstioConfigId>) {
    return (
      this.props.match.params.namespace === prevProps.match.params.namespace &&
      this.props.match.params.object === prevProps.match.params.object &&
      this.props.match.params.objectType === prevProps.match.params.objectType
    );
  }

  componentWillUnmount() {
    // Reset ask confirmation flag
    window.onbeforeunload = null;
    window.clearInterval(this.timerId);
  }

  backToList = () => {
    // Back to list page
    history.push(`/${Paths.ISTIO}?namespaces=${this.props.match.params.namespace}`);
  };

  canDelete = () => {
    return this.state.istioObjectDetails !== undefined && this.state.istioObjectDetails.permissions.delete;
  };

  canUpdate = () => {
    return this.state.istioObjectDetails !== undefined && this.state.istioObjectDetails.permissions.update;
  };

  onCancel = () => {
    this.backToList();
  };

  onDelete = () => {
    API.deleteIstioConfigDetail(
      this.props.match.params.namespace,
      this.props.match.params.objectType,
      this.props.match.params.object
    )
      .then(() => this.backToList())
      .catch(error => {
        AlertUtils.addError('Could not delete IstioConfig details.', error);
      });
  };

  onUpdate = () => {
    jsYaml.safeLoadAll(this.state.yamlModified, (objectModified: object) => {
      const jsonPatch = JSON.stringify(mergeJsonPatch(objectModified, getIstioObject(this.state.istioObjectDetails)));
      API.updateIstioConfigDetail(
        this.props.match.params.namespace,
        this.props.match.params.objectType,
        this.props.match.params.object,
        jsonPatch
      )
        .then(() => {
          const targetMessage =
            this.props.match.params.namespace +
            ' / ' +
            this.props.match.params.objectType +
            ' / ' +
            this.props.match.params.object;
          AlertUtils.add('Changes applied on ' + targetMessage, 'default', MessageType.SUCCESS);
          this.fetchIstioObjectDetails();
        })
        .catch(error => {
          AlertUtils.addError('Could not update IstioConfig details.', error);
          this.setState({
            yamlValidations: this.injectGalleyError(error)
          });
        });
    });
  };

  injectGalleyError = (error: AxiosError): AceValidations => {
    const msg: string[] = API.getErrorString(error).split(':');
    const errMsg: string = msg.slice(1, msg.length).join(':');
    const anno: Annotation = {
      column: 0,
      row: 0,
      text: errMsg,
      type: 'error'
    };

    return { annotations: [anno], markers: [] };
  };

  resizeEditor = () => {
    if (this.aceEditorRef.current) {
      // The Drawer has an async animation that needs a timeout before to resize the editor
      setTimeout(() => {
        const editor = this.aceEditorRef.current!['editor'];
        editor.resize(true);
      }, 250);
    }
  };

  onDrawerToggle = () => {
    this.setState(
      prevState => {
        return {
          isExpanded: !prevState.isExpanded
        };
      },
      () => this.resizeEditor()
    );
  };

  onDrawerClose = () => {
    this.setState(
      {
        isExpanded: false
      },
      () => this.resizeEditor()
    );
  };

  onEditorChange = (value: string) => {
    this.setState({
      isModified: true,
      yamlModified: value,
      istioValidations: undefined,
      yamlValidations: parseYamlValidations(value)
    });
  };

  onRefresh = () => {
    let refresh = true;
    if (this.state.isModified) {
      refresh = window.confirm('You have unsaved changes, are you sure you want to refresh ?');
    }
    if (refresh) {
      this.fetchIstioObjectDetails();
    }
  };

  fetchYaml = () => {
    if (this.state.isModified) {
      return this.state.yamlModified;
    }
    const istioObject = getIstioObject(this.state.istioObjectDetails);
    return istioObject ? jsYaml.safeDump(istioObject, safeDumpOptions) : '';
  };

  getStatusMessages = (istioConfigDetails?: IstioConfigDetails): ValidationMessage[] => {
    const istioObject = getIstioObject(istioConfigDetails);
    return istioObject && istioObject.status && istioObject.status.validationMessages
      ? istioObject.status.validationMessages
      : ([] as ValidationMessage[]);
  };

  // Not all Istio types have an overview card
  hasOverview = (): boolean => {
    return true;
  };

  objectReferences = (istioConfigDetails?: IstioConfigDetails): ObjectReference[] => {
    const details: IstioConfigDetails = istioConfigDetails || ({} as IstioConfigDetails);
    return details.references?.objectReferences || ([] as ObjectReference[]);
  };

  serviceReferences = (istioConfigDetails?: IstioConfigDetails): ServiceReference[] => {
    const details: IstioConfigDetails = istioConfigDetails || ({} as IstioConfigDetails);
    return details.references?.serviceReferences || ([] as ServiceReference[]);
  };

  workloadReferences = (istioConfigDetails?: IstioConfigDetails): ServiceReference[] => {
    const details: IstioConfigDetails = istioConfigDetails || ({} as IstioConfigDetails);
    return details.references?.workloadReferences || ([] as WorkloadReference[]);
  };

  helpMessages = (istioConfigDetails?: IstioConfigDetails): HelpMessage[] => {
    const details: IstioConfigDetails = istioConfigDetails || ({} as IstioConfigDetails);
    return details.help || ([] as HelpMessage[]);
  };

  // Aux function to calculate rows for 'status' and 'managedFields' which are typically folded
  getFoldRanges = (yaml: string | undefined): any => {
    let range = {
      startRow: -1,
      endRow: -1
    };

    if (!!yaml) {
      const ylines = yaml.split('\n');
      ylines.forEach((line: string, i: number) => {
        // Counting spaces to check managedFields, yaml is always processed with that structure so this is safe
        if (line.startsWith('status:') || line.startsWith('  managedFields:')) {
          if (range.startRow === -1) {
            range.startRow = i;
          } else if (range.startRow > i) {
            range.startRow = i;
          }
        }
        if (line.startsWith('spec:') && range.startRow !== -1) {
          range.endRow = i;
        }
      });
    }

    return range;
  };

  isExpanded = (istioConfigDetails?: IstioConfigDetails) => {
    let isExpanded = false;
    if (istioConfigDetails) {
      isExpanded = this.showCards(
        this.objectReferences(istioConfigDetails).length > 0,
        this.getStatusMessages(istioConfigDetails)
      );
    }
    return isExpanded;
  };

  showCards = (refPresent: boolean, istioStatusMsgs: ValidationMessage[]): boolean => {
    return refPresent || this.hasOverview() || istioStatusMsgs.length > 0;
  };

  onCursorChange = (e: any) => {
    const line = parseLine(this.fetchYaml(), e.cursor.row);
    this.setState({ selectedEditorLine: line });
  };

  renderEditor = () => {
    const yamlSource = this.fetchYaml();
    const istioStatusMsgs = this.getStatusMessages(this.state.istioObjectDetails);

    const objectReferences = this.objectReferences(this.state.istioObjectDetails);
    const serviceReferences = this.serviceReferences(this.state.istioObjectDetails);
    const workloadReferences = this.workloadReferences(this.state.istioObjectDetails);
    const helpMessages = this.helpMessages(this.state.istioObjectDetails);

    const refPresent = objectReferences.length > 0;
    const showCards = this.showCards(refPresent, istioStatusMsgs);
    let editorValidations: AceValidations = {
      markers: [],
      annotations: []
    };
    if (!this.state.isModified) {
      editorValidations = parseKialiValidations(yamlSource, this.state.istioValidations);
    } else {
      if (this.state.yamlValidations) {
        editorValidations.markers = this.state.yamlValidations.markers;
        editorValidations.annotations = this.state.yamlValidations.annotations;
      }
    }

    const helpAnnotations = parseHelpAnnotations(yamlSource, helpMessages);
    helpAnnotations.forEach(ha => editorValidations.annotations.push(ha));

    const panelContent = (
      <DrawerPanelContent>
        <DrawerHead>
          <div>
            {showCards && (
              <>
                {this.state.istioObjectDetails && (
                  <IstioConfigOverview
                    istioObjectDetails={this.state.istioObjectDetails}
                    istioValidations={this.state.istioValidations}
                    namespace={this.state.istioObjectDetails.namespace.name}
                    statusMessages={istioStatusMsgs}
                    objectReferences={objectReferences}
                    serviceReferences={serviceReferences}
                    workloadReferences={workloadReferences}
                    helpMessages={helpMessages}
                    selectedLine={this.state.selectedEditorLine}
                  />
                )}
              </>
            )}
          </div>
          <DrawerActions>
            <DrawerCloseButton onClick={this.onDrawerClose} />
          </DrawerActions>
        </DrawerHead>
      </DrawerPanelContent>
    );

    const editor = this.state.istioObjectDetails ? (
      <div style={{ width: '100%' }}>
        <AceEditor
          ref={this.aceEditorRef}
          mode="yaml"
          theme="eclipse"
          onChange={this.onEditorChange}
          height={'var(--kiali-yaml-editor-height)'}
          width={'100%'}
          className={'istio-ace-editor'}
          wrapEnabled={true}
          readOnly={!this.canUpdate()}
          setOptions={aceOptions}
          value={this.state.istioObjectDetails ? yamlSource : undefined}
          annotations={editorValidations.annotations}
          markers={editorValidations.markers}
          onCursorChange={this.onCursorChange}
        />
      </div>
    ) : null;

    return (
      <div className={`object-drawer ${editorDrawer}`}>
        {showCards ? (
          <Drawer isExpanded={this.state.isExpanded} isInline={true}>
            <DrawerContent panelContent={showCards ? panelContent : undefined}>
              <DrawerContentBody>{editor}</DrawerContentBody>
            </DrawerContent>
          </Drawer>
        ) : (
          editor
        )}
        {this.renderActionButtons(showCards)}
      </div>
    );
  };

  renderActionButtons = (showOverview: boolean) => {
    // User won't save if file has yaml errors
    const yamlErrors = !!(this.state.yamlValidations && this.state.yamlValidations.markers.length > 0);
    return (
      <IstioActionButtonsContainer
        objectName={this.props.match.params.object}
        readOnly={!this.canUpdate()}
        canUpdate={this.canUpdate() && this.state.isModified && !this.state.isRemoved && !yamlErrors}
        onCancel={this.onCancel}
        onUpdate={this.onUpdate}
        onRefresh={this.onRefresh}
        showOverview={showOverview}
        overview={this.state.isExpanded}
        onOverview={this.onDrawerToggle}
      />
    );
  };

  renderActions = () => {
    const canDelete =
      this.state.istioObjectDetails !== undefined &&
      this.state.istioObjectDetails.permissions.delete &&
      !this.state.isRemoved;
    const istioObject = getIstioObject(this.state.istioObjectDetails);

    return (
      <span className={rightToolbarStyle}>
        <IstioActionDropdown
          objectKind={istioObject ? istioObject.kind : undefined}
          objectName={this.props.match.params.object}
          canDelete={canDelete}
          onDelete={this.onDelete}
        />
      </span>
    );
  };

  render() {
    return (
      <>
        <RenderHeader
          location={this.props.location}
          rightToolbar={<RefreshButtonContainer key={'Refresh'} handleRefresh={this.onRefresh} />}
          actionsToolbar={this.renderActions()}
        />
        <ParameterizedTabs
          id="basic-tabs"
          onSelect={tabValue => {
            this.setState({ currentTab: tabValue });
          }}
          tabMap={paramToTab}
          tabName={tabName}
          defaultTab={this.defaultTab()}
          activeTab={this.state.currentTab}
          mountOnEnter={false}
          unmountOnExit={true}
        >
          <Tab key="istio-yaml" title={`YAML ${this.state.isModified ? ' * ' : ''}`} eventKey={0}>
            <RenderComponentScroll>{this.renderEditor()}</RenderComponentScroll>
          </Tab>
        </ParameterizedTabs>
        <Prompt
          message={location => {
            if (this.state.isModified) {
              // Check if Prompt is invoked multiple times
              if (this.promptTo === location.pathname) {
                return true;
              }
              this.promptTo = location.pathname;
              return 'You have unsaved changes, are you sure you want to leave?';
            }
            return true;
          }}
        />
      </>
    );
  }
}

export default IstioConfigDetailsPage;
